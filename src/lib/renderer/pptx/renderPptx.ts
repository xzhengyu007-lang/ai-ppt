/**
 * Pptx 渲染器 —— 只消费 ResolvedSlide，不自己算坐标/字号。
 *
 * 关键决策（都有实测依据，见 docs/research/F-导出spike2-版本A-B实测.md）：
 *  1. 用 pptxgenjs-plus（4.0.1 的图表轴引用是坏的、还有幽灵 slideMaster）；
 *  2. **不传 fit**：PptxGenJS 不传就不写 autofit，PowerPoint/WPS 都不会替我们缩放，
 *     溢出完全由 IR 层负责，避免"预览显示正常、导出偷偷缩小"的不一致；
 *  3. 折行已在 resolve 阶段定死，这里逐行写文本框，不交给渲染器自动换行；
 *  4. 导出后统一后处理（见 postprocess.ts）：补 notesMaster、重打包压缩。
 */
import PptxGenJS from "pptxgenjs-plus";
import {
  SLIDE_HEIGHT_IN,
  SLIDE_WIDTH_IN,
  pxToInch,
} from "@/lib/ir/constants";
import type { ResolvedElement, ResolvedSlide } from "@/lib/layout/resolve";
import { bulletItemBoxes } from "@/lib/layout/resolve";

type Pptx = InstanceType<typeof PptxGenJS> extends never ? any : any;

const LAYOUT_NAME = "IR_16x9";

function hex(color: string): string {
  return color.replace(/^#/, "").toUpperCase();
}

/** 把预折行的文本块写成整体一个文本框，逐行作为段落 */
function addTextBlock(
  slide: any,
  box: { x: number; y: number; w: number; h: number },
  block: {
    lines: string[];
    fontSize: number;
    lineHeightPx: number;
    letterSpacing: number;
    color: string;
    fontFace: string;
    bold: boolean;
    align: "left" | "center" | "right";
    valign: "top" | "middle" | "bottom";
    visibleLines: number;
  },
  opts: { bullet?: boolean; indent?: number; firstLineOffset?: number } = {}
) {
  const lines = block.lines;
  const lineSpacingPt = block.lineHeightPx * 0.75; // px → pt

  slide.addText(
    lines.map((line, i) => ({
      text: line,
      options: {
        breakLine: i < lines.length - 1,
        bullet: opts.bullet ? { code: "2022" } : undefined,
        indentLevel: 0,
      },
    })),
    {
      x: pxToInch(box.x),
      y: pxToInch(box.y),
      w: pxToInch(box.w),
      h: pxToInch(box.h),
      fontFace: block.fontFace,
      fontSize: block.fontSize * 0.75, // px → pt（96dpi 下 1px = 0.75pt）
      color: hex(block.color),
      bold: block.bold,
      align: block.align,
      valign: block.valign,
      margin: 0,
      lineSpacing: lineSpacingPt,
      charSpacing: block.letterSpacing ? block.letterSpacing * 0.75 : undefined,
      wrap: false, // 折行已定死，禁止渲染器再换行
      // 不传 fit / autoFit：见文件头说明
    }
  );
}

/**
 * 把远程图片转成 base64 data URI。
 *
 * 为什么必须做：pptxgenjs 在浏览器里不能用 `path`（那是 Node 读文件用），
 * 远程 URL 也不会被自动内联；不转 base64 的话导出的 pptx 里图片是空的。
 */
async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const base64 =
      typeof btoa === "function"
        ? btoa(bin)
        : // Node 环境（脚本生成示例、CI）走 Buffer
          Buffer.from(bytes).toString("base64");
    const mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }
}

/** 预先抓取所有远程图片，返回 url → dataURI 的映射 */
async function prefetchRemoteImages(slides: ResolvedSlide[]): Promise<Map<string, string>> {
  const urls = new Set<string>();
  for (const s of slides) {
    for (const el of s.elements) {
      if (el.kind === "image" && el.src && /^https?:\/\//.test(el.src)) urls.add(el.src);
    }
  }
  const map = new Map<string, string>();
  await Promise.all(
    [...urls].map(async (u) => {
      const uri = await toDataUri(u);
      if (uri) map.set(u, uri);
    })
  );
  return map;
}

export function renderSlide(
  pptx: any,
  rs: ResolvedSlide,
  chartTypeOf: (t: string) => any,
  imageMap?: Map<string, string>
) {
  const slide: any = pptx.addSlide();
  slide.background = { color: hex(rs.background) };

  for (const el of rs.elements) {
    switch (el.kind) {
      case "shape": {
        // 纯色块：横条、分隔线、KPI 卡片
        const isLine = el.box.h <= 3 || el.box.w <= 3;
        slide.addShape(pptx.ShapeType.rect, {
          x: pxToInch(el.box.x),
          y: pxToInch(el.box.y),
          w: pxToInch(Math.max(el.box.w, 1)),
          h: pxToInch(Math.max(el.box.h, 1)),
          fill: isLine
            ? { color: hex(el.fill ?? "000000") }
            : { color: hex(el.fill ?? "FFFFFF") },
          line: el.line
            ? { color: hex(el.line.color), width: el.line.width }
            : { color: hex(el.fill ?? "FFFFFF"), width: 0 },
          rectRadius: el.radius ? pxToInch(el.radius) : undefined,
        });
        break;
      }

      case "text": {
        addTextBlock(slide, el.box, el.block);
        break;
      }

      case "bullets": {
        // 几何来自 resolve 的单一来源，避免两套渲染器各算一遍
        const boxes = bulletItemBoxes(el.box, el.items.length, el.items[0].block.fontSize);
        el.items.forEach((item, i) => {
          const { dotBox, textBox } = boxes[i];
          slide.addShape(pptx.ShapeType.ellipse, {
            x: pxToInch(dotBox.x),
            y: pxToInch(dotBox.y),
            w: pxToInch(dotBox.w),
            h: pxToInch(dotBox.h),
            fill: { color: hex(el.markerColor) },
            line: { color: hex(el.markerColor), width: 0 },
          });
          addTextBlock(slide, textBox, item.block);
        });
        break;
      }

      case "chart": {
        const data = el.chart.series.map((s) => ({
          name: s.name,
          labels: el.chart.categories,
          values: s.values,
        }));
        slide.addChart(chartTypeOf(el.chart.type), data, {
          x: pxToInch(el.box.x),
          y: pxToInch(el.box.y),
          w: pxToInch(el.box.w),
          h: pxToInch(el.box.h),
          chartColors: el.colors.map(hex),
          showValue: el.chart.type !== "pie",
          catAxisLabelFontFace: el.colors ? undefined : undefined,
          legendPos: "b",
          barDir: "col",
          showLegend: el.chart.series.length > 1,
        });
        break;
      }

      case "image": {
        // 本期不接图库（素材红线）：无图时画一个带边框的占位块，保持版面结构
        if (el.src) {
          const remote = imageMap?.get(el.src);
          const data = el.src.startsWith("data:") ? el.src : remote;
          if (data) {
            slide.addImage({
              data,
              x: pxToInch(el.box.x),
              y: pxToInch(el.box.y),
              w: pxToInch(el.box.w),
              h: pxToInch(el.box.h),
              sizing: { type: "cover", w: pxToInch(el.box.w), h: pxToInch(el.box.h) },
            });
          } else {
            // 远程图抓取失败：画占位而不是崩掉，并在备注里留痕
            slide.addShape(pptx.ShapeType.rect, {
              x: pxToInch(el.box.x),
              y: pxToInch(el.box.y),
              w: pxToInch(el.box.w),
              h: pxToInch(el.box.h),
              fill: { color: "F0F2F5" },
              line: { color: "C9CFD8", width: 1, dashType: "dash" },
            });
          }
        } else {
          slide.addShape(pptx.ShapeType.rect, {
            x: pxToInch(el.box.x),
            y: pxToInch(el.box.y),
            w: pxToInch(el.box.w),
            h: pxToInch(el.box.h),
            fill: { color: "F0F2F5" },
            line: { color: "C9CFD8", width: 1, dashType: "dash" },
          });
        }
        break;
      }
    }
  }

  if (rs.notes.trim()) slide.addNotes(rs.notes);
  return slide;
}

export function createPresentation() {
  const pptx: any = new PptxGenJS();
  pptx.defineLayout({
    name: LAYOUT_NAME,
    width: SLIDE_WIDTH_IN,
    height: SLIDE_HEIGHT_IN,
  });
  pptx.layout = LAYOUT_NAME;
  pptx.author = "AI PPT";
  pptx.company = "AI PPT";
  return pptx;
}

export function chartTypeMapper(pptx: any) {
  const CT = pptx.ChartType;
  return (t: string) => (t === "line" ? CT.line : t === "pie" ? CT.pie : CT.bar);
}

/** 生成 pptx 二进制（浏览器与 Node 都可用） */
export async function renderDeckToBuffer(
  slides: ResolvedSlide[],
  meta: { title: string }
): Promise<ArrayBuffer> {
  const pptx = createPresentation();
  pptx.title = meta.title;
  const ct = chartTypeMapper(pptx);
  // 远程配图先转 base64，否则导出的 pptx 里图片是空的
  const imageMap = await prefetchRemoteImages(slides);
  for (const rs of slides) renderSlide(pptx, rs, ct, imageMap);
  const out = (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  return out;
}
