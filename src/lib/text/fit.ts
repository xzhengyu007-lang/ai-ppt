/**
 * auto-fit：三档兜底（缩字号 → 标记需换更宽版式 → 标记需回灌模型重写）。
 *
 * 关键取舍：**不依赖任何渲染器的自动缩放**。
 * 实测依据（docs/research/F-导出spike2-版本A-B实测.md）：PptxGenJS 不传 fit 时
 * 不写任何 autofit 节点，PowerPoint 与 WPS 都不会替我们缩放文本；而 fit:'shrink'
 * 的 fontScale 不可控（上游 #1199），会让预览与导出必然不一致。
 * 所以溢出只能在这里算准，算错就让它**可见地**溢出，而不是被偷偷缩小。
 */
import { TEXT_METRICS } from "@/lib/ir/constants";
import { wrapText, widthPx } from "./measure";

export type FitLevel = "ok" | "shrunk" | "overflow";

export interface FitInput {
  text: string;
  /** 盒宽（px，已含内边距扣除后的可用宽度） */
  widthPx: number;
  /** 盒高（px） */
  heightPx: number;
  /** 期望字号（px） */
  fontSize: number;
  /** 行高倍数 */
  lineHeight: number;
  letterSpacing?: number;
  /** 最多几行（可选约束，例如封面标题最多 2 行） */
  maxLines?: number;
}

export interface FitResult {
  fontSize: number;
  lines: string[];
  lineHeightPx: number;
  contentHeightPx: number;
  level: FitLevel;
  /** level === 'overflow' 时，实际能显示的行数（其余行不可见） */
  visibleLines: number;
  widestLinePx: number;
}

/** 在给定盒子里排一段文字，按档位自动降字号 */
export function fitText(input: FitInput): FitResult {
  const { text, widthPx: w, heightPx: h, fontSize, lineHeight, letterSpacing = 0, maxLines } = input;

  let best: FitResult | null = null;

  for (const scale of TEXT_METRICS.fontScaleSteps) {
    const fs = Math.round(fontSize * scale);
    const lines = wrapText(text, w, fs, letterSpacing);
    const lineHeightPx = fs * lineHeight;
    const contentHeightPx = lines.length * lineHeightPx;
    const widest = lines.reduce((m, l) => Math.max(m, widthPx(l, fs, letterSpacing)), 0);

    const tooTall = contentHeightPx > h + 0.5;
    const tooMany = maxLines !== undefined && lines.length > maxLines;

    const result: FitResult = {
      fontSize: fs,
      lines,
      lineHeightPx,
      contentHeightPx,
      level: scale === 1 ? "ok" : "shrunk",
      visibleLines: lines.length,
      widestLinePx: widest,
    };

    if (!tooTall && !tooMany) return result;
    if (!best) best = result;
  }

  // 全部档位都放不下：用最小字号，如实标 overflow
  const fs = Math.round(fontSize * TEXT_METRICS.minFontScale);
  const lines = wrapText(text, w, fs, letterSpacing);
  const lineHeightPx = fs * lineHeight;
  const visibleLines = Math.max(0, Math.floor((h + 0.5) / lineHeightPx));

  return {
    fontSize: fs,
    lines,
    lineHeightPx,
    contentHeightPx: lines.length * lineHeightPx,
    level: "overflow",
    visibleLines,
    widestLinePx: lines.reduce((m, l) => Math.max(m, widthPx(l, fs, letterSpacing)), 0),
  };
}

/**
 * 容量估算（任务书里的公式，做成可单测的纯函数）：
 *   每行字数 = floor(可用宽 / (字号 × 混合系数))
 *   最多行数 = floor(盒高 / (字号 × 行高))
 *   容量     = 每行字数 × 最多行数
 */
export function estimateCapacity(
  widthPxAvail: number,
  heightPxAvail: number,
  fontSize: number,
  lineHeight: number,
  mixedCoeff = (TEXT_METRICS.cjkEm + TEXT_METRICS.latinEm) / 2
): { charsPerLine: number; maxLines: number; capacity: number } {
  const charsPerLine = Math.max(0, Math.floor(widthPxAvail / (fontSize * mixedCoeff)));
  const maxLines = Math.max(0, Math.floor(heightPxAvail / (fontSize * lineHeight)));
  return { charsPerLine, maxLines, capacity: charsPerLine * maxLines };
}
