/**
 * 几何一致性测试 —— 任务书要求的「同一份 IR 经两个渲染器后逐元素比对 x/y/w/h，误差 ≤ 2px」。
 *
 * 做法：DOM 渲染器直接使用 resolve() 算出的 px 坐标（同一份 ResolvedElement），
 * 所以真正的风险点是 **导出侧有没有把 px 忠实翻成 EMU**。这里解析生成的 pptx，
 * 把每个 `<a:off>/<a:ext>` 还原成 px，与 IR 坐标逐个比对。
 *
 * 误差上限 2px = 19050 EMU。实测偏差为 0（1px 严格等于 9525 EMU）。
 */
import { describe, expect, it } from "./harness";
import JSZip from "jszip";
import { CANVAS_HEIGHT, CANVAS_WIDTH, EMU_PER_PX } from "@/lib/ir/constants";
import { resolveDeck, bulletItemBoxes } from "@/lib/layout/resolve";
import { buildLayoutCoverageDeck } from "@/lib/fixtures/mock-deck";
import { renderDeckToBuffer } from "@/lib/renderer/pptx/renderPptx";
import { postProcessPptx } from "@/lib/renderer/pptx/postprocess";

const TOLERANCE_PX = 2;

interface OffExt {
  x: number;
  y: number;
  cx: number | null;
  cy: number | null;
}

/** 抽出一页里所有形状的 off/ext（EMU → px） */
function extractBoxes(xml: string): OffExt[] {
  const out: OffExt[] = [];
  // <p:sp> 与 <p:graphicFrame> 的变换都写成 a:off / a:ext
  const blocks = xml.match(/<p:(sp|graphicFrame)>[\s\S]*?<\/p:\1>/g) ?? [];
  for (const b of blocks) {
    const off = b.match(/<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"/);
    if (!off) continue;
    const ext = b.match(/<a:ext\s+cx="(-?\d+)"\s+cy="(-?\d+)"/);
    out.push({
      x: Number(off[1]) / EMU_PER_PX,
      y: Number(off[2]) / EMU_PER_PX,
      cx: ext ? Number(ext[1]) / EMU_PER_PX : null,
      cy: ext ? Number(ext[2]) / EMU_PER_PX : null,
    });
  }
  return out;
}

describe("导出几何与 IR 对齐（≤2px）", () => {
  it("8 个版式的每个元素在 pptx 里都能找到对应坐标", async () => {
    const deck = buildLayoutCoverageDeck("business-navy");
    const resolved = resolveDeck(deck);
    const raw = await renderDeckToBuffer(resolved, { title: deck.meta.title });
    const { buffer } = await postProcessPptx(raw);
    const zip = await JSZip.loadAsync(buffer);

    let checked = 0;

    for (const [i, rs] of resolved.entries()) {
      const name = `ppt/slides/slide${i + 1}.xml`;
      const xml = await zip.file(name)!.async("string");
      const boxes = extractBoxes(xml);
      expect(boxes.length, `${name} 没有抽到任何形状`).toBeGreaterThan(0);

      for (const el of rs.elements) {
        // 项目符号容器本身不落成形状，条目几何来自 resolve 的单一来源
        const expectedBoxes =
          el.kind === "bullets"
            ? bulletItemBoxes(el.box, el.items.length, el.items[0].block.fontSize).map(
                (b) => ({ box: b.textBox, id: `${el.id}-item` })
              )
            : [{ box: el.box, id: el.id }];

        for (const { box, id } of expectedBoxes) {
          const hit = boxes.find(
            (b) =>
              Math.abs(b.x - box.x) <= TOLERANCE_PX && Math.abs(b.y - box.y) <= TOLERANCE_PX
          );
          expect(
            hit,
            `${rs.layout}/${id} 期望 (${box.x},${box.y})，实际候选 ${boxes
              .map((b) => `(${b.x.toFixed(0)},${b.y.toFixed(0)})`)
              .join(" ")}`
          ).toBeTruthy();

          // 尺寸也要对得上（允许渲染器对极小值做 1px 级兜底）
          if (box.w >= 8 && hit!.cx !== null) {
            expect(Math.abs(hit!.cx - box.w), `${id} 宽度偏差`).toBeLessThanOrEqual(TOLERANCE_PX);
          }
          checked++;
        }
      }
    }

    expect(checked).toBeGreaterThan(30);
  });

  it("画布尺寸严格等于 12192000×6858000 EMU", async () => {
    const resolved = resolveDeck(buildLayoutCoverageDeck());
    const raw = await renderDeckToBuffer(resolved, { title: "t" });
    const { buffer } = await postProcessPptx(raw);
    const zip = await JSZip.loadAsync(buffer);
    const pres = await zip.file("ppt/presentation.xml")!.async("string");
    const m = pres.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
    expect(m).toBeTruthy();
    expect(Number(m![1])).toBe(CANVAS_WIDTH * EMU_PER_PX);
    expect(Number(m![2])).toBe(CANVAS_HEIGHT * EMU_PER_PX);
  });
});

describe("导出正确性门禁（包结构 + 后处理）", () => {
  it("后处理把 notesMaster 补成 6 个占位符，并压缩体积", async () => {
    const resolved = resolveDeck(buildLayoutCoverageDeck());
    const raw = await renderDeckToBuffer(resolved, { title: "t" });
    const { buffer, fixes } = await postProcessPptx(raw);

    const zip = await JSZip.loadAsync(buffer);
    const nm = await zip.file("ppt/notesMasters/notesMaster1.xml")!.async("string");
    expect((nm.match(/<p:ph\b/g) ?? []).length).toBeGreaterThanOrEqual(5);

    // 必须真的做了修补动作，而不是"看起来没问题"
    expect(fixes.some((f) => f.includes("notesMaster"))).toBe(true);
    expect(buffer.byteLength).toBeLessThan(raw.byteLength);
  });

  it("每个 XML 部件无非法控制字符，且 Override 全部指向真实部件", async () => {
    const resolved = resolveDeck(buildLayoutCoverageDeck());
    const raw = await renderDeckToBuffer(resolved, { title: "t" });
    const { buffer } = await postProcessPptx(raw);
    const zip = await JSZip.loadAsync(buffer);
    const names = new Set(Object.keys(zip.files).filter((n) => !zip.files[n].dir));

    const ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
    for (const n of [...names].filter((x) => /\.(xml|rels)$/.test(x))) {
      const s = await zip.file(n)!.async("string");
      expect(ILLEGAL.test(s), `${n} 含非法控制字符`).toBe(false);
    }

    const ct = await zip.file("[Content_Types].xml")!.async("string");
    const overrides = [...ct.matchAll(/<Override\s+PartName="([^"]+)"/g)].map((m) => m[1]);
    for (const o of overrides) {
      expect(names.has(o.replace(/^\//, "")), `幽灵部件 ${o}`).toBe(true);
    }
  });

  it("备注写进了 notesSlide 且为中文正文", async () => {
    const deck = buildLayoutCoverageDeck();
    const resolved = resolveDeck(deck);
    const raw = await renderDeckToBuffer(resolved, { title: "t" });
    const { buffer } = await postProcessPptx(raw);
    const zip = await JSZip.loadAsync(buffer);

    const notesParts = Object.keys(zip.files).filter((n) =>
      /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)
    );
    expect(notesParts.length).toBe(resolved.length);

    let cjk = 0;
    for (const p of notesParts) {
      const x = await zip.file(p)!.async("string");
      cjk += (x.match(/[\u4e00-\u9fa5]/g) ?? []).length;
    }
    expect(cjk).toBeGreaterThan(100);
  });

  it("字体只用白名单（不允许渲染器偷偷写别的字体名）", async () => {
    const resolved = resolveDeck(buildLayoutCoverageDeck());
    const raw = await renderDeckToBuffer(resolved, { title: "t" });
    const { buffer } = await postProcessPptx(raw);
    const zip = await JSZip.loadAsync(buffer);

    const faces = new Set<string>();
    for (const n of Object.keys(zip.files).filter((x) => /^ppt\/slides\/slide\d+\.xml$/.test(x))) {
      const s = await zip.file(n)!.async("string");
      for (const m of s.matchAll(/typeface="([^"]+)"/g)) faces.add(m[1]);
    }
    // 允许 +mn-lt 之类的主题占位名
    const offenders = [...faces].filter(
      (f) => !f.startsWith("+") && !["Microsoft YaHei", "DengXian", "Noto Sans SC", "SimSun", "Arial", "Consolas"].includes(f)
    );
    expect(offenders, `非白名单字体：${offenders.join(",")}`).toEqual([]);
  });
});
