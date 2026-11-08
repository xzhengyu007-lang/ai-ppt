/**
 * layoutAssign —— **规则引擎，模型不参与**。
 *
 * 这是本项目的技术差异点，也是有硬反证的设计（docs/research/D-AI全链路.md §Q1）：
 * presenton 把版式选择交给 LLM，在中小模型上出现"封面页永不被选中"（#841），
 * issue 作者的解法是"把 prompt 写清楚点"——那是拿 prompt 修确定性 bug，死路。
 *
 * 所以这里用可测的打分：
 *   1. 结构角色（封面/目录/章节/结尾）直接映射，不参与打分；
 *   2. 内容形状（有图表 / 有 KPI / 有图 / 双栏）先做硬过滤；
 *   3. 剩下的候选按「字数预算契合度」打分，输出 chosenReason 与 rejected[]，
 *      便于 UI 解释"为什么这页是这个版式"，也便于换版式时给推荐。
 */
import type { LayoutId } from "@/lib/ir/constants";
import { LAYOUTS } from "@/lib/layout/definitions";

export type SlideRole =
  | "cover"
  | "toc"
  | "section"
  | "bullets"
  | "twocol"
  | "image"
  | "data"
  | "closing";

export interface SlideSpec {
  role: SlideRole;
  title: string;
  bullets?: string[];
  leftTitle?: string;
  leftBody?: string[];
  rightTitle?: string;
  rightBody?: string[];
  chart?: {
    type: "bar" | "line" | "pie";
    categories: string[];
    series: { name: string; values: number[] }[];
    insight?: string;
  };
  kpi?: { label: string; value: string; delta?: string }[];
  image?: { alt?: string };
  insight?: string;
}

export interface LayoutChoice {
  layout: LayoutId;
  reason: string;
  rejected: { layout: LayoutId; reason: string }[];
  /** 字数预算契合度 0~1，UI 可显示为"内容密度" */
  score: number;
}

const STRUCTURAL: Partial<Record<SlideRole, LayoutId>> = {
  cover: "cover",
  toc: "toc",
  section: "section",
  closing: "closing",
};

function textOf(spec: SlideSpec): string {
  return [
    spec.title,
    ...(spec.bullets ?? []),
    ...(spec.leftBody ?? []),
    ...(spec.rightBody ?? []),
    spec.insight ?? "",
  ]
    .filter(Boolean)
    .join("");
}

/** 粗略估算某版式能不能装下这份内容（用版式里最大的正文槽位做基准） */
function capacityScore(layout: LayoutId, bodyText: string): number {
  const def = LAYOUTS[layout];
  const bodySlot =
    def.slots.find((s) => s.role === "body") ?? def.slots.find((s) => s.role === "title");
  if (!bodySlot) return 0;

  const innerW = bodySlot.box.w - bodySlot.padding * 2;
  const innerH = bodySlot.box.h - bodySlot.padding * 2;
  const charsPerLine = Math.floor(innerW / bodySlot.fontSize);
  const maxLines = Math.floor(innerH / (bodySlot.fontSize * 1.5));
  const capacity = Math.max(1, charsPerLine * maxLines);
  const len = [...bodyText].length;

  if (len === 0) return 1;
  // 装得下但不要太空（利用率 0.35~0.9 最佳）
  const usage = len / capacity;
  if (usage > 1) return Math.max(0, 1 - (usage - 1) * 2);
  if (usage < 0.35) return 0.6 + usage;
  return 1;
}

/** 硬过滤：内容形状不匹配的版式直接排除，并写明原因 */
function shapeFilter(spec: SlideSpec): { ok: LayoutId[]; rejected: { layout: LayoutId; reason: string }[] } {
  const rejected: { layout: LayoutId; reason: string }[] = [];
  const candidates: LayoutId[] = ["bullets", "twocol", "data", "image", "toc"];

  const hasChart = Boolean(spec.chart);
  const hasKpi = Boolean(spec.kpi);
  const hasImage = Boolean(spec.image);
  const hasTwoCols = Boolean(spec.leftBody?.length && spec.rightBody?.length);

  const ok: LayoutId[] = [];
  for (const id of candidates) {
    let reason = "";
    if (id === "data" && !hasChart && !hasKpi) reason = "缺少图表或 KPI 数据";
    else if (id === "image" && !hasImage) reason = "没有配图";
    else if (id === "twocol" && !hasTwoCols) reason = "不是双栏结构（缺左/右栏内容）";
    else if (id === "toc" && (spec.bullets?.length ?? 0) > 8) reason = "条目超过 8 条，不适合目录页";
    else if (id === "bullets" && hasTwoCols) reason = "双栏内容用要点页会挤在一起";
    if (reason) rejected.push({ layout: id, reason });
    else ok.push(id);
  }
  // 有图表/KPI 时 data 必须优先
  if (hasChart || hasKpi) return { ok: ["data"], rejected: rejected.filter((r) => r.layout !== "data") };
  return { ok, rejected };
}

export function assignLayout(spec: SlideSpec): LayoutChoice {
  const structural = STRUCTURAL[spec.role];
  if (structural) {
    return {
      layout: structural,
      reason: `结构页固定使用 ${structural}`,
      rejected: [],
      score: 1,
    };
  }

  const { ok, rejected } = shapeFilter(spec);
  if (!ok.length) {
    return {
      layout: "bullets",
      reason: "没有版式完全匹配，退回要点页（内容会被压缩展示）",
      rejected,
      score: 0.4,
    };
  }

  const bodyText = textOf(spec);
  const scored = ok.map((layout) => ({ layout, score: capacityScore(layout, bodyText) }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  const rejectedAll = [
    ...rejected,
    ...scored.slice(1).map((s) => ({
      layout: s.layout,
      reason: `字数预算契合度更低（${s.score.toFixed(2)} < ${best.score.toFixed(2)}）`,
    })),
  ];

  return {
    layout: best.layout,
    reason: `内容形状匹配 ${ok.join("/")}，其中 ${best.layout} 字数预算契合度最高（${best.score.toFixed(2)}）`,
    rejected: rejectedAll,
    score: best.score,
  };
}

/** 换版式时给 UI 的候选推荐（含不可用原因） */
export function recommendLayouts(spec: SlideSpec): {
  layout: LayoutId;
  usable: boolean;
  reason: string;
  score: number;
}[] {
  const all = Object.keys(LAYOUTS) as LayoutId[];
  const bodyText = textOf(spec);
  const { ok } = shapeFilter(spec);

  // 反向查：某个版式被哪个结构角色占用
  const structuralOwner = new Map<LayoutId, SlideRole>();
  for (const [role, layout] of Object.entries(STRUCTURAL)) {
    if (layout) structuralOwner.set(layout, role as SlideRole);
  }

  return all.map((layout) => {
    const owner = structuralOwner.get(layout);
    if (owner) {
      const usable = spec.role === owner;
      return {
        layout,
        usable,
        reason: usable ? `结构页固定版式（${owner}）` : `该版式只用于「${owner}」，当前页是「${spec.role}」`,
        score: usable ? 1 : 0,
      };
    }
    if (!ok.includes(layout)) {
      const { rejected } = shapeFilter(spec);
      const why = rejected.find((r) => r.layout === layout)?.reason ?? "内容形状不匹配";
      return { layout, usable: false, reason: why, score: 0 };
    }
    const score = capacityScore(layout, bodyText);
    return {
      layout,
      usable: score > 0,
      reason:
        score > 0
          ? `字数预算契合度 ${score.toFixed(2)}`
          : "字数超出该版式预算，切换后大概率溢出",
      score,
    };
  });
}
