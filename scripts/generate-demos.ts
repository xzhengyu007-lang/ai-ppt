/**
 * 生成 3 份示例成品（商务汇报 / 学术答辩 / 产品发布）。
 *
 * 走的是和浏览器导出**完全相同的代码路径**：IR → resolve → pptx → 后处理，
 * 所以这里的产物就是产品能力，不是另写一套脚本拼出来的。
 *
 * 运行：node --import ./scripts/ts-alias.mjs scripts/generate-demos.ts
 */
import fs from "node:fs";
import path from "node:path";
import { buildMockDeck } from "@/lib/fixtures/mock-deck";
import { resolveDeck } from "@/lib/layout/resolve";
import { renderDeckToBuffer } from "@/lib/renderer/pptx/renderPptx";
import { postProcessPptx } from "@/lib/renderer/pptx/postprocess";
import { checkDeck } from "@/lib/llm/selfcheck";
import { deckSchema } from "@/lib/ir/schema";

const DEMOS = [
  { file: "01-商务汇报", topic: "2026 年 Q3 业务复盘", themeId: "business-navy" },
  { file: "02-学术答辩", topic: "面向复杂场景的多模态检索方法研究", themeId: "academic" },
  { file: "03-产品发布", topic: "智能工作台 2.0 产品发布", themeId: "product-launch" },
];

async function main() {
  const outDir = path.resolve("docs/examples");
  fs.mkdirSync(outDir, { recursive: true });

  for (const demo of DEMOS) {
    const deck = buildMockDeck({ topic: demo.topic, themeId: demo.themeId, slideCount: 10 });

    const parsed = deckSchema.safeParse(deck);
    if (!parsed.success) {
      throw new Error(`${demo.file}: IR 校验失败 ${parsed.error.issues[0]?.message}`);
    }

    const slides = resolveDeck(parsed.data);
    const raw = await renderDeckToBuffer(slides, { title: parsed.data.meta.title });
    const { buffer, fixes } = await postProcessPptx(raw);

    const outFile = path.join(outDir, `${demo.file}.pptx`);
    fs.writeFileSync(outFile, Buffer.from(buffer));

    const issues = checkDeck(parsed.data);
    const errors = issues.filter((i) => i.severity === "error").length;
    const warns = issues.filter((i) => i.severity === "warning").length;

    console.log(
      `✓ ${path.basename(outFile)}  ${(buffer.byteLength / 1024).toFixed(0)} KB  ` +
        `页 ${slides.length}  元素 ${slides.reduce((n, s) => n + s.elements.length, 0)}  ` +
        `校验错误 ${errors} 提示 ${warns}`
    );
    for (const f of fixes) console.log(`    · ${f}`);
  }

  console.log(`\n输出目录：${outDir}`);
}

main().catch((e) => {
  console.error("生成示例失败：", e);
  process.exit(1);
});
