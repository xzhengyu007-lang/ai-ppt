/**
 * 8 套版式的槽位几何 —— **数据，不是代码**。
 *
 * 这是相对所有参考项目的净改进（见 docs/research/C-内容版式分离.md §3）：
 * Slidev 的版式是不可复用组件，Marp 的版式是 CSS 类名，Kami 把几何留在 Python 里；
 * 我们把几何搬进数据，于是「12 套主题 × 8 版式」是 20 个产物而不是 96 个。
 *
 * 坐标系固定 1280×720 px。左右安全边距 80，上下 56/64。
 */
import type { LayoutId, SlotRole } from "@/lib/ir/constants";
import type { SlotContentKind } from "@/lib/ir/schema";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ColorKey =
  | "primary"
  | "secondary"
  | "accent"
  | "background"
  | "surface"
  | "onPrimary"
  | "text1"
  | "text2"
  | "text3"
  | "border"
  | "sectionBg"
  | "onSection";

export interface SlotDef {
  id: string;
  role: SlotRole;
  /** 该槽位接受哪些内容类型；layoutAssign 规则引擎据此打分 */
  accepts: SlotContentKind[];
  box: Box;
  /** 内边距（px），四边相同；可用宽 = w - 2*padding */
  padding: number;
  /** 期望字号（px），auto-fit 会在此基础上按档位下调 */
  fontSize: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  colorKey?: ColorKey;
  maxLines?: number;
  /** 硬性字数上限，超出即校验失败（内容契约） */
  maxChars?: number;
  required?: boolean;
}

export interface DecorDef {
  kind: "bar" | "rule" | "block";
  box: Box;
  colorKey: ColorKey;
  radius?: number;
}

export interface LayoutDef {
  id: LayoutId;
  /** 中文名，UI 里显示 */
  name: string;
  /** 使用哪种底色 */
  background: "background" | "sectionBg" | "surface";
  slots: SlotDef[];
  decor?: DecorDef[];
}

const M = 80; // 安全边距

export const LAYOUTS: Record<LayoutId, LayoutDef> = {
  /* ------------------------------------------------------------ 封面 */
  cover: {
    id: "cover",
    name: "封面",
    background: "background",
    decor: [{ kind: "bar", box: { x: M, y: 176, w: 96, h: 8 }, colorKey: "accent", radius: 4 }],
    slots: [
      {
        id: "eyebrow",
        role: "eyebrow",
        accepts: ["text"],
        box: { x: M, y: 112, w: 1120, h: 44 },
        padding: 0,
        fontSize: 15,
        colorKey: "accent",
        bold: true,
        maxChars: 40,
        maxLines: 1,
      },
      {
        id: "title",
        role: "title",
        accepts: ["text"],
        box: { x: M, y: 208, w: 1120, h: 216 },
        padding: 0,
        fontSize: 56,
        bold: true,
        colorKey: "primary",
        maxLines: 3,
        maxChars: 42,
        required: true,
      },
      {
        id: "subtitle",
        role: "subtitle",
        accepts: ["text"],
        box: { x: M, y: 446, w: 1120, h: 76 },
        padding: 0,
        fontSize: 22,
        colorKey: "text2",
        maxChars: 60,
        maxLines: 2,
      },
      {
        id: "footer",
        role: "footer",
        accepts: ["text"],
        box: { x: M, y: 636, w: 1120, h: 32 },
        padding: 0,
        fontSize: 13,
        colorKey: "text3",
        maxChars: 60,
        maxLines: 1,
      },
    ],
  },

  /* ------------------------------------------------------------ 目录 */
  toc: {
    id: "toc",
    name: "目录",
    background: "background",
    slots: [
      {
        id: "title",
        role: "title",
        accepts: ["text"],
        box: { x: M, y: 56, w: 1120, h: 92 },
        padding: 0,
        fontSize: 40,
        bold: true,
        colorKey: "primary",
        maxLines: 1,
        maxChars: 20,
        required: true,
      },
      {
        id: "body",
        role: "body",
        accepts: ["bullets"],
        box: { x: M, y: 186, w: 1120, h: 434 },
        padding: 0,
        fontSize: 24,
        colorKey: "text1",
        maxChars: 220,
        required: true,
      },
    ],
  },

  /* ---------------------------------------------------------- 章节页 */
  section: {
    id: "section",
    name: "章节页",
    background: "sectionBg",
    decor: [{ kind: "bar", box: { x: M, y: 292, w: 72, h: 6 }, colorKey: "accent", radius: 3 }],
    slots: [
      {
        id: "eyebrow",
        role: "eyebrow",
        accepts: ["text"],
        box: { x: M, y: 236, w: 1120, h: 44 },
        padding: 0,
        fontSize: 15,
        colorKey: "accent",
        bold: true,
        maxChars: 24,
        maxLines: 1,
      },
      {
        id: "title",
        role: "title",
        accepts: ["text"],
        box: { x: M, y: 316, w: 1120, h: 152 },
        padding: 0,
        fontSize: 48,
        bold: true,
        colorKey: "onSection",
        maxLines: 2,
        maxChars: 30,
        required: true,
      },
      {
        id: "subtitle",
        role: "subtitle",
        accepts: ["text"],
        box: { x: M, y: 484, w: 1120, h: 60 },
        padding: 0,
        fontSize: 20,
        colorKey: "onSection",
        maxChars: 50,
        maxLines: 2,
      },
    ],
  },

  /* ---------------------------------------------------------- 要点页 */
  bullets: {
    id: "bullets",
    name: "要点页",
    background: "background",
    slots: [
      {
        id: "title",
        role: "title",
        accepts: ["text"],
        box: { x: M, y: 56, w: 1120, h: 104 },
        padding: 0,
        fontSize: 34,
        bold: true,
        colorKey: "primary",
        maxLines: 2,
        maxChars: 38,
        required: true,
      },
      {
        id: "body",
        role: "body",
        accepts: ["bullets", "text"],
        box: { x: M, y: 200, w: 1120, h: 400 },
        padding: 0,
        fontSize: 24,
        colorKey: "text1",
        maxChars: 180,
        required: true,
      },
    ],
  },

  /* -------------------------------------------------------- 双栏对比 */
  twocol: {
    id: "twocol",
    name: "双栏对比",
    background: "background",
    decor: [{ kind: "rule", box: { x: 640, y: 200, w: 2, h: 400 }, colorKey: "border" }],
    slots: [
      {
        id: "title",
        role: "title",
        accepts: ["text"],
        box: { x: M, y: 56, w: 1120, h: 96 },
        padding: 0,
        fontSize: 32,
        bold: true,
        colorKey: "primary",
        maxLines: 2,
        maxChars: 34,
        required: true,
      },
      {
        id: "leftTitle",
        role: "subtitle",
        accepts: ["text"],
        box: { x: M, y: 186, w: 500, h: 48 },
        padding: 0,
        fontSize: 21,
        bold: true,
        colorKey: "accent",
        maxChars: 18,
        maxLines: 1,
        required: true,
      },
      {
        id: "leftBody",
        role: "body",
        accepts: ["bullets", "text"],
        box: { x: M, y: 250, w: 500, h: 340 },
        padding: 0,
        fontSize: 19,
        colorKey: "text1",
        maxChars: 130,
        required: true,
      },
      {
        id: "rightTitle",
        role: "subtitle",
        accepts: ["text"],
        box: { x: 700, y: 186, w: 500, h: 48 },
        padding: 0,
        fontSize: 21,
        bold: true,
        colorKey: "accent",
        maxChars: 18,
        maxLines: 1,
        required: true,
      },
      {
        id: "rightBody",
        role: "body",
        accepts: ["bullets", "text"],
        box: { x: 700, y: 250, w: 500, h: 340 },
        padding: 0,
        fontSize: 19,
        colorKey: "text1",
        maxChars: 130,
        required: true,
      },
    ],
  },

  /* ---------------------------------------------------------- 图文页 */
  image: {
    id: "image",
    name: "图文页",
    background: "background",
    slots: [
      {
        id: "title",
        role: "title",
        accepts: ["text"],
        box: { x: M, y: 56, w: 1120, h: 96 },
        padding: 0,
        fontSize: 32,
        bold: true,
        colorKey: "primary",
        maxLines: 2,
        maxChars: 34,
        required: true,
      },
      {
        id: "image",
        role: "image",
        accepts: ["image"],
        box: { x: M, y: 190, w: 520, h: 380 },
        padding: 0,
        fontSize: 0,
        required: false,
      },
      {
        id: "body",
        role: "body",
        accepts: ["bullets", "text"],
        box: { x: 660, y: 190, w: 540, h: 380 },
        padding: 0,
        fontSize: 19,
        colorKey: "text1",
        maxChars: 140,
        required: true,
      },
      {
        id: "caption",
        role: "caption",
        accepts: ["text"],
        box: { x: M, y: 588, w: 520, h: 56 },
        padding: 0,
        fontSize: 12,
        colorKey: "text3",
        maxChars: 60,
        maxLines: 2,
      },
    ],
  },

  /* ---------------------------------------------------------- 数据页 */
  data: {
    id: "data",
    name: "数据页",
    background: "background",
    slots: [
      {
        id: "title",
        role: "title",
        accepts: ["text"],
        box: { x: M, y: 56, w: 1120, h: 96 },
        padding: 0,
        fontSize: 32,
        bold: true,
        colorKey: "primary",
        maxLines: 2,
        maxChars: 34,
        required: true,
      },
      {
        id: "chart",
        role: "chart",
        accepts: ["chart"],
        box: { x: M, y: 180, w: 780, h: 396 },
        padding: 0,
        fontSize: 0,
      },
      {
        id: "kpi",
        role: "kpi",
        accepts: ["kpi"],
        box: { x: M, y: 180, w: 1120, h: 180 },
        padding: 16,
        fontSize: 34,
      },
      {
        id: "insight",
        role: "caption",
        accepts: ["text"],
        box: { x: 880, y: 180, w: 320, h: 396 },
        padding: 0,
        fontSize: 18,
        colorKey: "text2",
        maxChars: 90,
        maxLines: 8,
      },
      {
        id: "caption",
        role: "caption",
        accepts: ["text"],
        box: { x: M, y: 596, w: 1120, h: 56 },
        padding: 0,
        fontSize: 12,
        colorKey: "text3",
        maxChars: 90,
        maxLines: 2,
      },
    ],
  },

  /* ---------------------------------------------------------- 结尾页 */
  closing: {
    id: "closing",
    name: "结尾页",
    background: "sectionBg",
    decor: [{ kind: "bar", box: { x: M, y: 216, w: 96, h: 8 }, colorKey: "accent", radius: 4 }],
    slots: [
      {
        id: "title",
        role: "title",
        accepts: ["text"],
        box: { x: M, y: 248, w: 1120, h: 160 },
        padding: 0,
        fontSize: 48,
        bold: true,
        colorKey: "onSection",
        maxLines: 2,
        maxChars: 26,
        required: true,
      },
      {
        id: "subtitle",
        role: "subtitle",
        accepts: ["text"],
        box: { x: M, y: 428, w: 1120, h: 80 },
        padding: 0,
        fontSize: 20,
        colorKey: "onSection",
        maxChars: 60,
        maxLines: 2,
      },
      {
        id: "footer",
        role: "footer",
        accepts: ["text"],
        box: { x: M, y: 636, w: 1120, h: 32 },
        padding: 0,
        fontSize: 13,
        colorKey: "onSection",
        maxChars: 60,
        maxLines: 1,
      },
    ],
  },
};

export const LAYOUT_LIST: LayoutDef[] = Object.values(LAYOUTS);

export function getLayout(id: LayoutId): LayoutDef {
  const l = LAYOUTS[id];
  if (!l) throw new Error(`未知版式：${id}`);
  return l;
}
