/**
 * Slide IR —— 全项目唯一事实源。
 *
 * 预览（DOM 渲染器）与导出（Pptx 渲染器）都只读这一份结构，禁止任何一方
 * 另存坐标或字号。schema 变化必须同步改 resolve.ts 与两个渲染器。
 */
import { z } from "zod";
import { LAYOUT_IDS, ALLOWED_FONT_NAMES } from "./constants";

const hexColor = z
  .string()
  .regex(/^[0-9a-fA-F]{6}$/, "颜色必须是不带 # 的 6 位十六进制，例如 1F3864");

const fontName = z
  .string()
  .refine((v) => ALLOWED_FONT_NAMES.includes(v), {
    message: `字体必须在白名单内：${ALLOWED_FONT_NAMES.join(" / ")}`,
  });

/* ------------------------------------------------------------------ 主题 */

export const themeTokensSchema = z.object({
  colors: z.object({
    primary: hexColor,
    secondary: hexColor,
    accent: hexColor,
    background: hexColor,
    surface: hexColor,
    onPrimary: hexColor,
    /** 章节页/结尾页的大面积底色。与 primary 分开，深色主题才不会自相矛盾 */
    sectionBg: hexColor,
    /** 章节页/结尾页上的文字色 */
    onSection: hexColor,
    text1: hexColor,
    text2: hexColor,
    text3: hexColor,
  }),
  fonts: z.object({
    zh: fontName,
    en: fontName,
    mono: fontName,
  }),
  rhythm: z.object({
    /** 基础节奏单位（px），版式内间距一律取它的整数倍 */
    unit: z.number().positive(),
    /** 章节级间距（px） */
    sectionGap: z.number().positive(),
  }),
  radius: z.number().min(0),
  border: z.object({
    width: z.number().min(0),
    color: hexColor,
  }),
  lineHeight: z.object({
    title: z.number().min(1).max(2),
    body: z.number().min(1).max(2),
  }),
});

/* ---------------------------------------------------------------- 槽位内容 */

export const textContentSchema = z.object({
  kind: z.literal("text"),
  text: z.string(),
});

export const bulletsContentSchema = z.object({
  kind: z.literal("bullets"),
  items: z.array(z.string()).min(1).max(6),
});

export const kpiContentSchema = z.object({
  kind: z.literal("kpi"),
  items: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        delta: z.string().optional(),
      })
    )
    .min(2)
    .max(4),
});

export const chartContentSchema = z.object({
  kind: z.literal("chart"),
  chart: z.object({
    type: z.enum(["bar", "line", "pie"]),
    categories: z.array(z.string()).min(1).max(12),
    series: z
      .array(
        z.object({
          name: z.string(),
          values: z.array(z.number()).min(1).max(12),
        })
      )
      .min(1)
      .max(4),
  }),
 /** 图表下方一句话结论（数据页必备） */
  insight: z.string().optional(),
});

export const imageContentSchema = z.object({
  kind: z.literal("image"),
  /** null 表示纯图形占位（默认不接图库，红线：不抓商业素材） */
  src: z.string().nullable(),
  alt: z.string().optional(),
});

export const quoteContentSchema = z.object({
  kind: z.literal("quote"),
  text: z.string(),
  attribution: z.string().optional(),
});

export const slotContentSchema = z.discriminatedUnion("kind", [
  textContentSchema,
  bulletsContentSchema,
  kpiContentSchema,
  chartContentSchema,
  imageContentSchema,
  quoteContentSchema,
]);

/* ------------------------------------------------------------------ 页与册 */

export const slideSchema = z.object({
  id: z.string().min(1),
  layout: z.enum(LAYOUT_IDS),
  /** key 是版式里定义的槽位 id */
  slots: z.record(z.string(), slotContentSchema),
  /** 演讲者备注，导出时写进 slide.addNotes；每页目标 ≥80 字 */
  notes: z.string(),
  /** 降级/溢出等非致命标记，UI 必须可见 */
  warnings: z.array(z.string()),
});

export const deckMetaSchema = z.object({
  title: z.string().min(1),
  size: z.literal("16:9"),
  templateId: z.string().min(1),
  themeId: z.string().min(1),
  locale: z.enum(["zh-CN", "en-US"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const deckSchema = z.object({
  schemaVersion: z.literal("1.0"),
  meta: deckMetaSchema,
  /** 解析后的主题 token 直接内嵌，保证 deck 自包含、导出不依赖注册表查找 */
  theme: themeTokensSchema,
  slides: z.array(slideSchema).min(1).max(40),
});

/* ------------------------------------------------------------------- 类型 */

export type ThemeTokens = z.infer<typeof themeTokensSchema>;
export type SlotContent = z.infer<typeof slotContentSchema>;
export type Slide = z.infer<typeof slideSchema>;
export type DeckMeta = z.infer<typeof deckMetaSchema>;
export type Deck = z.infer<typeof deckSchema>;

export type SlotContentKind = SlotContent["kind"];

/** 解析并校验；失败时抛出带路径的可读错误，绝不静默降级 */
export function parseDeck(input: unknown): Deck {
  const r = deckSchema.safeParse(input);
  if (!r.success) {
    const lines = r.error.issues.map(
      (i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`
    );
    throw new Error(`Slide IR 校验失败：\n${lines.join("\n")}`);
  }
  return r.data;
}
