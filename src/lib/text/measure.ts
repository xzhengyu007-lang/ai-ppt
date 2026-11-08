/**
 * 确定性文本测量 —— 不依赖浏览器、不依赖 scrollHeight、不依赖任何字体文件。
 *
 * 为什么必须自己做：任务书硬要求「文字不溢出要有测试」。浏览器里测出来的行高
 * 在 PowerPoint 里不成立，反过来也一样；唯一能在 CI 里跑单测的口径就是这套
 * 字符宽度表 + 贪心折行。
 *
 * 已知局限（写进 docs/已知差异.md）：
 *  - 拉丁字符平均宽 0.55em 是统计值，大写字与窄字会偏差；
 *  - 真实避头尾依赖排版引擎，这里只做保守近似。
 */
import { TEXT_METRICS } from "@/lib/ir/constants";

/** 行首禁则字符（不能出现在行首） */
const NO_LINE_START = new Set(
  "，。、；：？！）】》」』”’%,.;:?!)]}·・".split("")
);

/** 行尾禁则字符（不能出现在行尾） */
const NO_LINE_END = new Set("（【《「『“‘([{".split(""));

/** 单个字符的宽度（em） */
export function charEm(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;

  // 空格
  if (ch === " " || ch === "\u3000") return TEXT_METRICS.spaceEm;

  // CJK 统一表意文字
  if (code >= 0x4e00 && code <= 0x9fff) return TEXT_METRICS.cjkEm;
  // CJK 标点 / 全角形式
  if (code >= 0x3000 && code <= 0x303f) return TEXT_METRICS.cjkEm;
  if (code >= 0xff00 && code <= 0xffef) return TEXT_METRICS.cjkEm;
  // 扩展 A 与兼容区
  if (code >= 0x3400 && code <= 0x4dbf) return TEXT_METRICS.cjkEm;

  // 数字与拉丁字母
  if (/[0-9A-Za-z]/.test(ch)) return TEXT_METRICS.latinEm;

  // 其余拉丁标点偏窄
  if (code < 0x2000) return 0.32;

  return 0.6;
}

/**
 * 一段文字的宽度（em）。letterSpacing 必须逐字累加（pp-master #199 的实测坑）：
 * 总宽 = Σ字宽 + letterSpacing × (n − 1)
 */
export function widthEm(text: string, letterSpacingEm = 0): number {
  if (!text) return 0;
  let w = 0;
  for (const ch of text) w += charEm(ch);
  if (letterSpacingEm > 0 && text.length > 1) w += letterSpacingEm * (text.length - 1);
  return w;
}

/** 一段文字的宽度（px） */
export function widthPx(
  text: string,
  fontSizePx: number,
  letterSpacingPx = 0
): number {
  return widthEm(text, fontSizePx > 0 ? letterSpacingPx / fontSizePx : 0) * fontSizePx;
}

/** 贪心折行：把一段文字按可用宽度切成若干行 */
export function wrapText(
  text: string,
  maxWidthPx: number,
  fontSizePx: number,
  letterSpacingPx = 0
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");

  for (const para of paragraphs) {
    if (para === "") {
      lines.push("");
      continue;
    }
    const chars = [...para];
    let start = 0;

    while (start < chars.length) {
      let width = 0;
      let end = start;
      // 逐字累加，找到能放下的最长前缀
      while (end < chars.length) {
        const w = charEm(chars[end]) * fontSizePx + letterSpacingPx;
        if (width + w > maxWidthPx && end > start) break;
        width += w;
        end++;
      }

      // 拉丁文优先在空格处断，避免把单词劈断
      if (end < chars.length) {
        const nextIsLatinWord =
          /[A-Za-z0-9]/.test(chars[end] ?? "") && /[A-Za-z0-9]/.test(chars[end - 1] ?? "");
        if (nextIsLatinWord) {
          let sp = end - 1;
          while (sp > start && chars[sp] !== " ") sp--;
          if (sp > start && sp - start > (end - start) * 0.4) end = sp + 1;
        }

        // 行首禁则：把标点拉回上一行（宁可轻微超宽，也不要标点跑到行首）
        let guard = 0;
        while (
          end < chars.length &&
          NO_LINE_START.has(chars[end]) &&
          guard < 2
        ) {
          end++;
          guard++;
        }
        // 行尾禁则：开括号不能留在行尾
        if (end > start + 1 && NO_LINE_END.has(chars[end - 1])) {
          end--;
        }
      }

      lines.push(chars.slice(start, end).join(""));
      start = end;
    }
  }

  return lines;
}
