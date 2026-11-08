/**
 * pnpm eval —— 20 个主题黄金集 × 8 项自动质检。
 *
 * 8 项与任务书一致：JSON 合法 / 无空页 / 文本溢出 / 字号越界 / 导出通过 /
 * 字体缺失 / 图片 404 / 单套耗时。
 *
 * 全部跑在 mock 模式下，所以 CI 不依赖外网与 Key。
 * 运行：node --import ./scripts/ts-alias.mjs scripts/eval.ts
 */
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { buildMockDeck } from "@/lib/fixtures/mock-deck";
import { deckSchema } from "@/lib/ir/schema";
import { resolveDeck } from "@/lib/layout/resolve";
import { renderDeckToBuffer } from "@/lib/renderer/pptx/renderPptx";
import { postProcessPptx } from "@/lib/renderer/pptx/postprocess";
import { checkDeck } from "@/lib/llm/selfcheck";
import { ALLOWED_FONT_NAMES, EMU_PER_PX } from "@/lib/ir/constants";

/** 15 个常规主题 + 5 个中文长标题压力用例 */
const TOPICS = [
  "2026 年 Q3 业务复盘",
  "新能源行业的产能与需求平衡分析",
  "企业数据中台建设方案汇报",
  "年度人才发展与组织能力盘点",
  "供应链数字化转型路线图",
  "区域门店网络扩张可行性研究",
  "研发效能度量体系搭建",
  "客户服务体验升级专项汇报",
  "海外市场进入策略与风险评估",
  "安全生产管理体系年度总结",
  "财务共享中心运营优化方案",
  "品牌焕新与传播策略提案",
  "智能制造产线改造投资评估",
  "合规管理体系落地进度汇报",
  "新员工培训体系设计说明",
  // —— 压力用例：中文超长标题 ——
  "关于进一步深化某某领域体制机制改革若干问题的若干意见",
  "贯彻落实上级关于加快数字基础设施建设决策部署的实施办法",
  "关于开展年度重点领域风险隐患排查整治专项行动的工作方案",
  "推动产业链供应链韧性与安全水平提升三年行动计划的说明",
  "关于建立健全现代企业制度完善公司治理结构的指导意见",
];

interface CaseResult {
  topic: string;
  jsonOk: boolean;
  noEmptySlide: boolean;
  noOverflow: boolean;
  fontSizeOk: boolean;
  exportOk: boolean;
  fontOk: boolean;
  noBadImage: boolean;
  ms: number;
  slides: number;
  sizeKb: number;
  problems: string[];
}

const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 60;

async function assertPackage(buf: ArrayBuffer): Promise<string[]> {
  const problems: string[] = [];
  const zip = await JSZip.loadAsync(buf);
  const names = new Set(Object.keys(zip.files).filter((n) => !zip.files[n].dir));

  const ct = await zip.file("[Content_Types].xml")!.async("string");
  const overrides = [...ct.matchAll(/<Override\s+PartName="([^"]+)"/g)].map((m) => m[1]);
  for (const o of overrides) {
    if (!names.has(o.replace(/^\//, ""))) problems.push(`幽灵部件 ${o}`);
  }

  const pres = await zip.file("ppt/presentation.xml")!.async("string");
  const sz = pres.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
  if (!sz || Number(sz[1]) !== 1280 * EMU_PER_PX) problems.push("画布尺寸不对");

  const ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
  for (const n of [...names].filter((x) => /\.(xml|rels)$/.test(x))) {
    if (ILLEGAL.test(await zip.file(n)!.async("string"))) problems.push(`${n} 含非法控制字符`);
  }

  for (const n of [...names].filter((x) => /^ppt\/charts\/chart\d+\.xml$/.test(x))) {
    const x = await zip.file(n)!.async("string");
    const defined = new Set(
      ["c:catAx", "c:valAx", "c:serAx", "c:dateAx"].flatMap((tag) =>
        [...x.matchAll(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, "g"))].flatMap((b) =>
          [...b[0].matchAll(/<c:axId\s+val="(-?\d+)"/g)].slice(0, 1).map((m) => m[1])
        )
      )
    );
    const refs = new Set(
      ["c:barChart", "c:lineChart", "c:pieChart"].flatMap((tag) =>
        [...x.matchAll(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, "g"))].flatMap((b) =>
          [...b[0].matchAll(/<c:axId\s+val="(-?\d+)"/g)].map((m) => m[1])
        )
      )
    );
    for (const r of refs) if (!defined.has(r)) problems.push(`${n} 孤儿 axId ${r}`);
  }

  const nm = await zip.file("ppt/notesMasters/notesMaster1.xml")?.async("string");
  if (!nm) problems.push("缺 notesMaster");
  else if ((nm.match(/<p:ph\b/g) ?? []).length < 5) problems.push("notesMaster 占位符不足");

  return problems;
}

async function evalCase(topic: string, themeId: string): Promise<CaseResult> {
  const problems: string[] = [];
  const t0 = Date.now();

  const deck = buildMockDeck({ topic, themeId, slideCount: 10 });

  // ① JSON 合法
  const parsed = deckSchema.safeParse(deck);
  const jsonOk = parsed.success;
  if (!jsonOk) problems.push(`IR 校验失败：${parsed.error.issues[0]?.message}`);

  const slides = resolveDeck(deck);

  // ② 无空页
  const emptySlides = slides.filter(
    (s) => !s.elements.some((e) => e.kind === "text" || e.kind === "bullets")
  );
  const noEmptySlide = emptySlides.length === 0;
  if (!noEmptySlide) problems.push(`空页：${emptySlides.map((s) => s.id).join(",")}`);

  // ③ 文本溢出
  const overflow = slides.flatMap((s) => s.warnings.filter((w) => w.includes("溢出")).map((w) => `${s.id}:${w}`));
  const noOverflow = overflow.length === 0;
  if (!noOverflow) problems.push(...overflow.slice(0, 3));

  // ④ 字号越界
  const badSizes: string[] = [];
  for (const s of slides) {
    for (const e of s.elements) {
      if (e.kind === "text" || e.kind === "bullets") {
        const blocks = e.kind === "text" ? [e.block] : e.items.map((i) => i.block);
        for (const b of blocks) {
          if (b.fontSize < FONT_SIZE_MIN || b.fontSize > FONT_SIZE_MAX) {
            badSizes.push(`${s.id}/${e.id} ${b.fontSize}px`);
          }
        }
      }
    }
  }
  const fontSizeOk = badSizes.length === 0;
  if (!fontSizeOk) problems.push(`字号越界：${badSizes.slice(0, 3).join(",")}`);

  // ⑤ 导出通过
  let exportOk = true;
  let sizeKb = 0;
  try {
    const raw = await renderDeckToBuffer(slides, { title: topic });
    const { buffer } = await postProcessPptx(raw);
    sizeKb = Math.round(buffer.byteLength / 1024);
    const pkgProblems = await assertPackage(buffer);
    if (pkgProblems.length) {
      exportOk = false;
      problems.push(...pkgProblems.slice(0, 3));
    }
  } catch (e) {
    exportOk = false;
    problems.push(`导出失败：${(e as Error).message}`);
  }

  // ⑥ 字体缺失（导出侧只能写白名单）
  const fontOk = deck.theme.fonts.zh
    ? ALLOWED_FONT_NAMES.includes(deck.theme.fonts.zh) &&
      ALLOWED_FONT_NAMES.includes(deck.theme.fonts.en)
    : false;
  if (!fontOk) problems.push(`字体不在白名单：${deck.theme.fonts.zh}`);

  // ⑦ 图片 404（本期不接外部图库：不允许任何非空外链）
  const badImages = slides.flatMap((s) =>
    s.elements
      .filter((e) => e.kind === "image" && e.src && !/^data:/.test(e.src))
      .map((e) => `${s.id}/${e.id}`)
  );
  const noBadImage = badImages.length === 0;
  if (!noBadImage) problems.push(`可疑图片引用：${badImages.join(",")}`);

  // 额外：内容契约（不影响 8 项判定，但记录）
  const issues = checkDeck(deck);
  const errs = issues.filter((i) => i.severity === "error");
  if (errs.length) problems.push(`内容契约错误 ${errs.length} 条`);

  return {
    topic,
    jsonOk,
    noEmptySlide,
    noOverflow,
    fontSizeOk,
    exportOk,
    fontOk,
    noBadImage,
    ms: Date.now() - t0,
    slides: slides.length,
    sizeKb,
    problems,
  };
}

async function main() {
  const themeIds = ["business-navy", "minimal-mono", "tech-dark", "academic", "fresh-green",
    "gov-red", "product-launch", "edu-warm", "finance-slate", "editorial-warm",
    "modern-violet", "corporate-teal"];

  console.log(`评测 ${TOPICS.length} 个主题 × 8 项检查（mock 模式）…\n`);
  const results: CaseResult[] = [];

  for (const [i, topic] of TOPICS.entries()) {
    const themeId = themeIds[i % themeIds.length];
    const r = await evalCase(topic, themeId);
    results.push(r);
    const flag =
      r.jsonOk && r.noEmptySlide && r.noOverflow && r.fontSizeOk && r.exportOk && r.fontOk && r.noBadImage
        ? "✓"
        : "✗";
    console.log(
      `${flag} ${String(i + 1).padStart(2)}. ${topic.slice(0, 24).padEnd(26)} ${themeId.padEnd(15)} ` +
        `${String(r.slides).padStart(2)}页 ${String(r.sizeKb).padStart(3)}KB ${String(r.ms).padStart(5)}ms` +
        (r.problems.length ? `  ⚠ ${r.problems.length}` : "")
    );
  }

  const total = results.length;
  const rate = (k: keyof CaseResult) =>
    Math.round((results.filter((r) => r[k] === true).length / total) * 100);
  const avgMs = Math.round(results.reduce((a, r) => a + r.ms, 0) / total);
  const allPass = results.filter((r) => r.problems.length === 0).length;

  console.log(`\n通过率：JSON ${rate("jsonOk")}% · 无空页 ${rate("noEmptySlide")}% · 无溢出 ${rate("noOverflow")}%`);
  console.log(`        字号 ${rate("fontSizeOk")}% · 导出 ${rate("exportOk")}% · 字体 ${rate("fontOk")}% · 图片 ${rate("noBadImage")}%`);
  console.log(`单套平均耗时：${avgMs} ms`);
  console.log(`完全无问题的用例：${allPass}/${total}`);

  // 写报告
  const md: string[] = [];
  md.push("# 评测报告\n");
  md.push(`> 生成时间：${new Date().toISOString()}`);
  md.push(`> 模式：mock（不联网、不需要 Key）；用例数：${total}（其中 5 个为中文长标题压力用例）\n`);

  md.push("## 汇总\n");
  md.push("| 指标 | 通过率 |");
  md.push("|---|---|");
  md.push(`| JSON 合法 | ${rate("jsonOk")}% |`);
  md.push(`| 无空页 | ${rate("noEmptySlide")}% |`);
  md.push(`| 文本溢出 | ${rate("noOverflow")}% |`);
  md.push(`| 字号越界 | ${rate("fontSizeOk")}% |`);
  md.push(`| 导出通过（包结构+图表轴+notesMaster） | ${rate("exportOk")}% |`);
  md.push(`| 字体白名单 | ${rate("fontOk")}% |`);
  md.push(`| 图片引用 | ${rate("noBadImage")}% |`);
  md.push(`| 单套平均耗时 | ${avgMs} ms |`);
  md.push(`| 完全通过的用例 | ${allPass}/${total} |\n`);

  md.push("## 逐用例\n");
  md.push("| # | 主题 | 主题模板 | 页数 | 体积 | 耗时 | JSON | 空页 | 溢出 | 字号 | 导出 | 字体 | 图片 |");
  md.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  const yn = (b: boolean) => (b ? "✓" : "✗");
  results.forEach((r, i) => {
    md.push(
      `| ${i + 1} | ${r.topic} | ${themeIds[i % themeIds.length]} | ${r.slides} | ${r.sizeKb} KB | ${r.ms} ms | ` +
        `${yn(r.jsonOk)} | ${yn(r.noEmptySlide)} | ${yn(r.noOverflow)} | ${yn(r.fontSizeOk)} | ${yn(r.exportOk)} | ${yn(r.fontOk)} | ${yn(r.noBadImage)} |`
    );
  });

  const withProblems = results.filter((r) => r.problems.length);
  md.push("\n## 失败/告警明细\n");
  if (!withProblems.length) {
    md.push("无。所有用例 8 项全通过。\n");
  } else {
    for (const r of withProblems) {
      md.push(`### ${r.topic}`);
      r.problems.forEach((p) => md.push(`- ${p}`));
      md.push("");
    }
  }

  md.push("## 压力用例说明\n");
  md.push(
    "5 个中文长标题用例（如「关于进一步深化某某领域体制机制改革若干问题的若干意见」）用于验证：\n" +
      "标题超长时 auto-fit 是否降字号、是否如实报溢出、换行是否在预算内。结果见上表。\n"
  );
  md.push("## 与上一版对比\n");
  md.push("本版为首次评测，无上一版可比。后续每次 `pnpm eval` 会覆盖本文件，保留在 git 历史里可对比。\n");

  const outFile = path.resolve("docs/评测报告.md");
  fs.writeFileSync(outFile, md.join("\n"), "utf8");
  console.log(`\n报告已写入 ${outFile}`);

  if (allPass !== total) process.exit(1);
}

main().catch((e) => {
  console.error("评测异常：", e);
  process.exit(1);
});
