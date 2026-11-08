/**
 * 画布口径 —— 全项目唯一的换算常量来源。
 *
 * 铁律：这些数字只在这里出现一次。任何渲染器、估算器、导出器都必须从这里取，
 * 禁止在别处写死 1280 / 720 / 9525 / 13.333 之类的魔法数。
 */

/** 1 英寸 = 96 像素（CSS 像素定义，也是 OOXML 里 px 与 EMU 的桥） */
export const PX_PER_INCH = 96;

/** 1 英寸 = 914400 EMU（OOXML 固定值） */
export const EMU_PER_INCH = 914400;

/** 1 像素 = 9525 EMU。几何一致性测试依赖这个等式严格成立。 */
export const EMU_PER_PX = EMU_PER_INCH / PX_PER_INCH; // 9525

/** IR 画布尺寸（px） */
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

/** 画布尺寸（inch） */
export const SLIDE_WIDTH_IN = CANVAS_WIDTH / PX_PER_INCH; // 13.3333...
export const SLIDE_HEIGHT_IN = CANVAS_HEIGHT / PX_PER_INCH; // 7.5

/** 画布尺寸（EMU），必须等于 12192000 × 6858000 */
export const SLIDE_WIDTH_EMU = CANVAS_WIDTH * EMU_PER_PX; // 12192000
export const SLIDE_HEIGHT_EMU = CANVAS_HEIGHT * EMU_PER_PX; // 6858000

/** px → inch（导出侧用） */
export const pxToInch = (px: number): number => px / PX_PER_INCH;

/** px → EMU（导出侧用） */
export const pxToEmu = (px: number): number => Math.round(px * EMU_PER_PX);

/** EMU → px（校验/读回用） */
export const emuToPx = (emu: number): number => emu / EMU_PER_PX;

/**
 * 字体白名单 —— 跨平台常见、PowerPoint/WPS 都能命中。
 * 关键：字面量必须精确匹配，写错名字 = 静默回退 = 行高变化 = 溢出。
 * 苹方仅 macOS 有，绝不作为唯一选项。
 */
export const FONT_WHITELIST = {
  /** Windows 装机率接近 100%，中文主选 */
  yahei: "Microsoft YaHei",
  /** Windows 自带，备选 */
  dengxian: "DengXian",
  /** 跨平台，OFL 可自托管 webfont */
  notoSC: "Noto Sans SC",
  /** 兜底 */
  simsun: "SimSun",
  /** 西文/数字 */
  latin: "Arial",
  /** 等宽数字（KPI、表格） */
  mono: "Consolas",
} as const;

export type FontKey = keyof typeof FONT_WHITELIST;

/** 不在白名单里的字体一律拒绝写入 pptx（导出前校验用） */
export const ALLOWED_FONT_NAMES: readonly string[] = Object.values(FONT_WHITELIST);

/** 版式 ID（8 种，固定） */
export const LAYOUT_IDS = [
  "cover",
  "toc",
  "section",
  "bullets",
  "twocol",
  "image",
  "data",
  "closing",
] as const;

export type LayoutId = (typeof LAYOUT_IDS)[number];

/** 槽位语义角色 */
export const SLOT_ROLES = [
  "eyebrow",
  "title",
  "subtitle",
  "body",
  "kpi",
  "chart",
  "image",
  "quote",
  "caption",
  "footer",
] as const;

export type SlotRole = (typeof SLOT_ROLES)[number];

/** 文本预算的确定性系数（不含浏览器测量） */
export const TEXT_METRICS = {
  /** 全角字符宽度（em） */
  cjkEm: 1.0,
  /** 西文字母/数字平均宽度（em） */
  latinEm: 0.55,
  /** 空格宽度（em） */
  spaceEm: 0.28,
  /** 行高倍数 —— 中文正文用 1.4~1.55，标题可压缩 */
  lineHeightWide: 1.5,
  lineHeightNormal: 1.4,
  lineHeightTight: 1.25,
  /** auto-fit 最小字号比例 */
  minFontScale: 0.85,
  /** auto-fit 降字号档位 */
  fontScaleSteps: [1, 0.95, 0.9, 0.85],
  /** 单行宽度安全余量（无衬线 / 有衬线），来自 ppt-master #199 的实测修法 */
  widthSafetySans: 1.18,
  widthSafetySerif: 1.4,
} as const;
