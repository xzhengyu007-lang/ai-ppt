/**
 * IR + 版式 + 主题 → ResolvedSlide（最终排版结果）。
 *
 * 这是「单一事实源」的落地点：**两个渲染器都只消费 ResolvedSlide**，
 * 谁也不许自己再算一遍坐标、字号、折行。折行在这里就定死（预折行），
 * 于是 DOM 与 pptx 看到的是同一串行文本 —— 这是几何误差能压到 ≤2px 的根本原因。
 */
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  TEXT_METRICS,
  type LayoutId,
  type SlotRole,
} from "@/lib/ir/constants";
import type { Deck, SlotContent, Slide, ThemeTokens } from "@/lib/ir/schema";
import { fitText, type FitLevel } from "@/lib/text/fit";
import { getLayout, type Box, type ColorKey, type SlotDef } from "./definitions";
import { composeLayout, type CompositionId } from "./compositions";
import { getTheme } from "@/lib/theme/themes";

export interface ResolvedTextBlock {
  lines: string[];
  fontSize: number;
  lineHeightPx: number;
  letterSpacing: number;
  color: string;
  fontFace: string;
  bold: boolean;
  align: "left" | "center" | "right";
  valign: "top" | "middle" | "bottom";
  fitLevel: FitLevel;
  visibleLines: number;
}

export type ResolvedElement =
  | { kind: "text"; id: string; role: SlotRole; box: Box; block: ResolvedTextBlock }
  | {
      kind: "bullets";
      id: string;
      role: SlotRole;
      box: Box;
      items: { block: ResolvedTextBlock; marker: string }[];
      markerColor: string;
    }
  | {
      kind: "shape";
      id: string;
      box: Box;
      fill?: string;
      line?: { color: string; width: number };
      radius?: number;
    }
  | {
      kind: "chart";
      id: string;
      role: SlotRole;
      box: Box;
      chart: Extract<SlotContent, { kind: "chart" }>["chart"];
      colors: string[];
    }
  | { kind: "image"; id: string; role: SlotRole; box: Box; src: string | null; alt?: string };

export interface ResolvedSlide {
  id: string;
  layout: LayoutId;
  width: number;
  height: number;
  background: string;
  elements: ResolvedElement[];
  notes: string;
  warnings: string[];
}

export function colorOf(theme: ThemeTokens, key: ColorKey): string {
  if (key === "border") return theme.border.color;
  if (key === "sectionBg") return theme.colors.sectionBg;
  if (key === "onSection") return theme.colors.onSection;
  return theme.colors[key];
}

const alignOf = (s: SlotDef) => s.align ?? "left";
const valignOf = (s: SlotDef) => s.valign ?? "top";

function textBlock(
  theme: ThemeTokens,
  slot: SlotDef,
  text: string,
  maxLines: number | undefined,
  letterSpacing = 0
): ResolvedTextBlock {
  const innerW = Math.max(8, slot.box.w - slot.padding * 2);
  const innerH = Math.max(8, slot.box.h - slot.padding * 2);
  const lhRatio =
    slot.role === "title" ? theme.lineHeight.title : theme.lineHeight.body;

  const r = fitText({
    text,
    widthPx: innerW,
    heightPx: innerH,
    fontSize: slot.fontSize,
    lineHeight: lhRatio,
    letterSpacing,
    maxLines,
  });

  return {
    lines: r.lines,
    fontSize: r.fontSize,
    lineHeightPx: r.lineHeightPx,
    letterSpacing,
    color: colorOf(theme, slot.colorKey ?? "text1"),
    fontFace:
      slot.role === "title" || slot.role === "eyebrow"
        ? (theme.fonts.display ?? theme.fonts.zh)
        : theme.fonts.zh,
    bold: slot.bold ?? false,
    align: alignOf(slot),
    valign: valignOf(slot),
    fitLevel: r.level,
    visibleLines: r.visibleLines,
  };
}

function padBox(slot: SlotDef): Box {
  return {
    x: slot.box.x + slot.padding,
    y: slot.box.y + slot.padding,
    w: slot.box.w - slot.padding * 2,
    h: slot.box.h - slot.padding * 2,
  };
}

export const BULLET_GAP = 10;

/**
 * 项目符号条目的几何 —— **单一来源**。
 * DOM 渲染器、pptx 渲染器、几何一致性测试都必须调这个函数，
 * 否则三处各算一遍就必然漂移（这条是踩出来的）。
 */
export function bulletItemBoxes(
  box: Box,
  itemCount: number,
  fontSize: number
): { dotBox: Box; textBox: Box; itemTop: number }[] {
  if (itemCount <= 0) return [];
  const perH = (box.h - BULLET_GAP * (itemCount - 1)) / itemCount;
  const dot = Math.max(4, fontSize * 0.22);
  return Array.from({ length: itemCount }, (_, i) => {
    const itemTop = box.y + i * (perH + BULLET_GAP);
    return {
      itemTop,
      dotBox: { x: box.x, y: itemTop + fontSize * 0.55, w: dot, h: dot },
      textBox: { x: box.x + dot + 12, y: itemTop, w: box.w - dot - 12, h: perH },
    };
  });
}

/** 把一页 IR 解析成最终元素列表 */
export function resolveSlide(deck: Deck, slide: Slide, index = 0): ResolvedSlide {
  const theme = deck.theme;
  // 构图语言来自模板注册表（deck 只存 tokens，构图属于模板定义）
  let composition: CompositionId = "standard";
  try {
    composition = getTheme(deck.meta.themeId).composition;
  } catch {
    composition = "standard";
  }
  const layout = composeLayout(getLayout(slide.layout), composition, theme);
  const elements: ResolvedElement[] = [];
  const warnings: string[] = [...slide.warnings];
  /** 图库素材的署名，最后并进 caption */
  let pendingCredit: string | undefined;

  // 装饰元素先画，保证在文字下层
  for (const [i, d] of (layout.decor ?? []).entries()) {
    elements.push({
      kind: "shape",
      id: `decor-${i}`,
      box: d.box,
      fill: colorOf(theme, d.colorKey),
      radius: d.radius ?? 0,
    });
  }

  for (const slot of layout.slots) {
    const content = slide.slots[slot.id];

    if (!content) {
      if (slot.required) warnings.push(`缺少必需槽位：${slot.id}（${slot.role}）`);
      continue;
    }

    // 字数契约：超了要打标记，不静默
    if (slot.maxChars !== undefined) {
      const len = plainTextOf(content).length;
      if (len > slot.maxChars) {
        warnings.push(
          `槽位 ${slot.id} 超出字数预算：${len} / ${slot.maxChars}`
        );
      }
    }

    switch (content.kind) {
      case "text": {
        if (!content.text.trim()) {
          warnings.push(`槽位 ${slot.id} 内容为空`);
          break;
        }
        const block = textBlock(
          theme,
          slot,
          content.text,
          slot.maxLines,
          slot.role === "eyebrow" ? 1.2 : 0
        );
        if (block.fitLevel === "overflow") {
          warnings.push(`槽位 ${slot.id} 文字溢出（已缩到最小字号仍放不下）`);
        } else if (block.fitLevel === "shrunk") {
          warnings.push(`槽位 ${slot.id} 已自动降字号 ${block.fontSize}px`);
        }
        elements.push({
          kind: "text",
          id: slot.id,
          role: slot.role,
          box: padBox(slot),
          block,
        });
        break;
      }

      case "bullets": {
        const items = content.items.filter((t) => t.trim().length > 0);
        if (!items.length) {
          warnings.push(`槽位 ${slot.id} 无要点`);
          break;
        }
        // 逐条按可用高度均分，单条最多 2 行
        const innerH = slot.box.h - slot.padding * 2;
        const perItemH = Math.floor(innerH / items.length);
        const itemSlot: SlotDef = {
          ...slot,
          box: { x: slot.box.x, y: slot.box.y, w: slot.box.w, h: perItemH },
        };
        const resolved = items.map((t) => ({
          block: textBlock(theme, itemSlot, t, 2),
          marker: "•",
        }));
        const overflow = resolved.some((r) => r.block.fitLevel === "overflow");
        if (overflow) warnings.push(`槽位 ${slot.id} 有要点溢出`);
        elements.push({
          kind: "bullets",
          id: slot.id,
          role: slot.role,
          box: padBox(slot),
          items: resolved,
          markerColor: colorOf(theme, "accent"),
        });
        break;
      }

      case "kpi": {
        const items = content.items;
        const gap = 24;
        const cardW = (slot.box.w - gap * (items.length - 1)) / items.length;
        const cardH = slot.box.h;

        items.forEach((it, i) => {
          const x = slot.box.x + i * (cardW + gap);
          elements.push({
            kind: "shape",
            id: `kpi-card-${i}`,
            box: { x, y: slot.box.y, w: cardW, h: cardH },
            fill: theme.colors.surface,
            line: { color: theme.border.color, width: theme.border.width },
            radius: theme.radius,
          });

          const valueSlot: SlotDef = {
            id: `${slot.id}-value-${i}`,
            role: "kpi",
            accepts: ["text"],
            box: { x: x + 24, y: slot.box.y + 28, w: cardW - 48, h: 60 },
            padding: 0,
            fontSize: slot.fontSize,
            bold: true,
            colorKey: "primary",
          };
          elements.push({
            kind: "text",
            id: `${slot.id}-value-${i}`,
            role: "kpi",
            box: padBox(valueSlot),
            block: textBlock(theme, valueSlot, it.value, 1),
          });

          const labelSlot: SlotDef = {
            id: `${slot.id}-label-${i}`,
            role: "kpi",
            accepts: ["text"],
            box: { x: x + 24, y: slot.box.y + 96, w: cardW - 48, h: 56 },
            padding: 0,
            fontSize: 12,
            colorKey: "text2",
          };
          elements.push({
            kind: "text",
            id: `${slot.id}-label-${i}`,
            role: "kpi",
            box: padBox(labelSlot),
            block: textBlock(theme, labelSlot, it.label, 2),
          });

          if (it.delta) {
            const deltaSlot: SlotDef = {
              id: `${slot.id}-delta-${i}`,
              role: "caption",
              accepts: ["text"],
              box: { x: x + 24, y: slot.box.y + cardH - 34, w: cardW - 48, h: 24 },
              padding: 0,
              fontSize: 13,
              colorKey: "accent",
            };
            elements.push({
              kind: "text",
              id: `${slot.id}-delta-${i}`,
              role: "caption",
              box: padBox(deltaSlot),
              block: textBlock(theme, deltaSlot, it.delta, 1),
            });
          }
        });
        break;
      }

      case "chart": {
        // 数据自洽性检查：每个系列的取值数必须等于分类数
        const { categories, series } = content.chart;
        const bad = series.filter((s) => s.values.length !== categories.length);
        if (bad.length) {
          warnings.push(
            `槽位 ${slot.id} 图表数据不一致：分类 ${categories.length} 个，系列 ${bad
              .map((s) => `${s.name}(${s.values.length})`)
              .join("/")}`
          );
        }
        elements.push({
          kind: "chart",
          id: slot.id,
          role: slot.role,
          box: slot.box,
          chart: content.chart,
          colors: [
            theme.colors.primary,
            theme.colors.accent,
            theme.colors.secondary,
            theme.colors.text3,
          ],
        });
        break;
      }

      case "image": {
        elements.push({
          kind: "image",
          id: slot.id,
          role: slot.role,
          box: slot.box,
          src: content.src,
          alt: content.alt,
        });
        if (!content.src) {
          warnings.push(`槽位 ${slot.id} 未配图（使用纯图形占位）`);
        }
        // 图库素材的署名统一并进 caption（图片下方那行小字），压在图上会看不清
        if (content.credit) {
          pendingCredit = content.credit;
        }
        break;
      }

      case "quote": {
        const block = textBlock(theme, slot, content.text, slot.maxLines);
        elements.push({
          kind: "text",
          id: slot.id,
          role: slot.role,
          box: padBox(slot),
          block,
        });
        break;
      }
    }
  }

  // 章节页的大号页序（编辑排版 / 竖栏构图才有）——高级模板的常见元素
  if (slide.layout === "section" && composition !== "standard" && index > 0) {
    const numeral = String(index + 1).padStart(2, "0");
    const lh = 1.0;
    elements.push({
      kind: "text",
      id: "section-numeral",
      role: "caption",
      box: { x: 880, y: 168, w: 320, h: 300 },
      block: {
        lines: [numeral],
        fontSize: 200,
        lineHeightPx: 200 * lh,
        letterSpacing: 0,
        color: colorOf(theme, composition === "editorial" ? "text3" : "sectionBg"),
        fontFace: theme.fonts.display ?? theme.fonts.zh,
        bold: true,
        align: "right",
        valign: "middle",
        fitLevel: "ok",
        visibleLines: 1,
      },
    });
  }

  // 图库素材署名：并进 caption（没有 caption 就补一个）
  if (pendingCredit) {
    const captionSlot = layout.slots.find((s) => s.id === "caption");
    const existing = elements.find(
      (e) => e.id === "caption" && e.kind === "text"
    ) as Extract<ResolvedElement, { kind: "text" }> | undefined;

    const baseText = existing ? existing.block.lines.join("") : "";
    const merged = baseText ? `${baseText} · ${pendingCredit}` : pendingCredit;

    if (existing) {
      existing.block = textBlock(theme, captionSlot!, merged, captionSlot?.maxLines ?? 2);
    } else if (captionSlot) {
      elements.push({
        kind: "text",
        id: "caption",
        role: "caption",
        box: padBox(captionSlot),
        block: textBlock(theme, captionSlot, merged, captionSlot.maxLines ?? 2),
      });
    }
  }

  return {
    id: slide.id,
    layout: slide.layout,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    background: colorOf(theme, layout.background),
    elements,
    notes: slide.notes,
    warnings,
  };
}

export function resolveDeck(deck: Deck): ResolvedSlide[] {
  return deck.slides.map((s, i) => resolveSlide(deck, s, i));
}

/** 用于字数统计与纯文本提取（不含标记） */
export function plainTextOf(content: SlotContent): string {
  switch (content.kind) {
    case "text":
      return content.text;
    case "bullets":
      return content.items.join("");
    case "kpi":
      return content.items.map((i) => `${i.label}${i.value}${i.delta ?? ""}`).join("");
    case "chart":
      return `${content.chart.series.map((s) => s.name).join("")}${content.insight ?? ""}`;
    case "image":
      return content.alt ?? "";
    case "quote":
      return content.text;
  }
}

/** 全局兜底：任何一行都不该超过画布安全宽度 */
export const MAX_SAFE_TEXT_WIDTH = CANVAS_WIDTH - 160;

export function assertNoHorizontalOverflow(elements: ResolvedElement[]): string[] {
  const bad: string[] = [];
  for (const el of elements) {
    if (el.box.x < 0 || el.box.y < 0) bad.push(`${el.id} 位置为负`);
    if (el.box.x + el.box.w > CANVAS_WIDTH + 0.5) bad.push(`${el.id} 横向出界`);
    if (el.box.y + el.box.h > CANVAS_HEIGHT + 0.5) bad.push(`${el.id} 纵向出界`);
  }
  return bad;
}

/** 便于测试：把某个槽位在给定版式下的可用宽高暴露出来 */
export function slotCapacity(slot: SlotDef, lineHeightRatio: number) {
  const innerW = slot.box.w - slot.padding * 2;
  const innerH = slot.box.h - slot.padding * 2;
  const mixed =
    (TEXT_METRICS.cjkEm + TEXT_METRICS.latinEm) / 2;
  return {
    charsPerLine: Math.floor(innerW / (slot.fontSize * mixed)),
    maxLines: Math.floor(innerH / (slot.fontSize * lineHeightRatio)),
    innerW,
    innerH,
  };
}
