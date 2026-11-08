/**
 * 五步生成流水线：brief → outline → slideSpec → layoutAssign → selfCheck
 *
 * 产品决策（任务书 5.2）：**两段式**。先出大纲让用户改，再逐页生成。
 * 不一次性吐完整套——既无法纠偏，又烧 token，失败了整份重来。
 *
 * 降级策略（任务书 5.4）：结构化输出连续失败 → 降级为"标题 + 要点"并打 warning，
 * **绝不允许静默出空页**。
 */
import { z } from "zod";
import type { Deck, Slide, SlotContent } from "@/lib/ir/schema";
import type { LayoutId } from "@/lib/ir/constants";
import { getTheme } from "@/lib/theme/themes";
import { assignLayout, type SlideRole, type SlideSpec } from "./layout-assign";
import { checkDeck, type Issue } from "./selfcheck";
import { chatJson, getConfig, isMockMode, LlmError, type TokenUsage } from "./provider";
import { buildMockDeck } from "@/lib/fixtures/mock-deck";

/* ------------------------------------------------------------------ 结构化输出 */

export const briefSchema = z.object({
  audience: z.string().min(1),
  scenario: z.string().min(1),
  durationMin: z.number().int().min(3).max(180),
  slideCount: z.number().int().min(5).max(20),
  language: z.enum(["zh-CN", "en-US"]),
  style: z.string().min(1),
  coreMessage: z.string().min(1),
});
export type Brief = z.infer<typeof briefSchema>;

export const outlineItemSchema = z.object({
  title: z.string().min(2).max(60),
  role: z.enum(["cover", "toc", "section", "bullets", "twocol", "image", "data", "closing"]),
  point: z.string().max(120),
});
export const outlineSchema = z.object({
  items: z.array(outlineItemSchema).min(5).max(20),
});
export type OutlineItem = z.infer<typeof outlineItemSchema>;

export const slideSpecSchema = z.object({
  slides: z
    .array(
      z.object({
        role: z.enum(["cover", "toc", "section", "bullets", "twocol", "image", "data", "closing"]),
        title: z.string().min(2),
        bullets: z.array(z.string()).max(6).optional(),
        leftTitle: z.string().optional(),
        leftBody: z.array(z.string()).max(5).optional(),
        rightTitle: z.string().optional(),
        rightBody: z.array(z.string()).max(5).optional(),
        kpi: z
          .array(
            z.object({
              label: z.string(),
              value: z.string(),
              delta: z.string().optional(),
            })
          )
          .max(4)
          .optional(),
        chart: z
          .object({
            type: z.enum(["bar", "line", "pie"]),
            categories: z.array(z.string()).min(1).max(12),
            series: z
              .array(z.object({ name: z.string(), values: z.array(z.number()).min(1).max(12) }))
              .min(1)
              .max(4),
            insight: z.string().optional(),
          })
          .optional(),
        insight: z.string().optional(),
        subtitle: z.string().optional(),
        eyebrow: z.string().optional(),
        footer: z.string().optional(),
        imageAlt: z.string().optional(),
        notes: z.string(),
        /** 模型自检发现的问题（原样保留给 UI） */
        selfCheck: z.string().optional(),
      })
    )
    .min(1),
});
export type SlideSpecOut = z.infer<typeof slideSpecSchema>["slides"][number];

/* -------------------------------------------------------------------- 进度事件 */

export type ProgressEvent =
  | { type: "step"; step: "brief" | "outline" | "slideSpec" | "layoutAssign" | "selfCheck"; message: string }
  | { type: "slide"; index: number; total: number; title: string; layout: LayoutId }
  | { type: "warning"; message: string }
  | { type: "usage"; usage: TokenUsage; totalTokens: number }
  | { type: "done"; deck: Deck; issues: Issue[] }
  | { type: "error"; message: string };

export interface GenerateOptions {
  topic: string;
  themeId?: string;
  slideCount?: number;
  /** 第二段可以用第一段确认过的大纲 */
  outline?: OutlineItem[];
  onProgress?: (e: ProgressEvent) => void;
  /** 预算上限，超过就截断并告警 */
  maxTokens?: number;
}

/* ------------------------------------------------------------------ mock 数据 */

const MOCK_BRIEF: Brief = {
  audience: "公司管理层与业务负责人",
  scenario: "季度经营复盘会",
  durationMin: 20,
  slideCount: 10,
  language: "zh-CN",
  style: "克制、数据驱动、结论先行",
  coreMessage: "增长是结构性的，下一步要把可复制的部分固化成流程",
};

function mockOutline(topic: string, count: number): OutlineItem[] {
  const deck = buildMockDeck({ topic, slideCount: count });
  return deck.slides.map((s) => ({
    title:
      s.slots.title?.kind === "text" ? s.slots.title.text : `${topic}`,
    role: s.layout as OutlineItem["role"],
    point: s.notes.slice(0, 60),
  }));
}

/** 把 mock deck 反解成 SlideSpec，让 mock 模式也真的走规则引擎与校验器 */
function mockSpecs(topic: string, count: number): SlideSpecOut[] {
  const deck = buildMockDeck({ topic, slideCount: count });
  return deck.slides.map((s) => {
    const t = (k: string) =>
      s.slots[k]?.kind === "text" ? (s.slots[k] as { text: string }).text : undefined;
    const bullets = (k: string) =>
      s.slots[k]?.kind === "bullets" ? (s.slots[k] as { items: string[] }).items : undefined;
    const chart = s.slots.chart?.kind === "chart" ? s.slots.chart.chart : undefined;
    const kpi = s.slots.kpi?.kind === "kpi" ? s.slots.kpi.items : undefined;

    return {
      role: s.layout as SlideSpecOut["role"],
      title: t("title") ?? topic,
      bullets: bullets("body"),
      leftTitle: t("leftTitle"),
      leftBody: bullets("leftBody"),
      rightTitle: t("rightTitle"),
      rightBody: bullets("rightBody"),
      chart,
      kpi,
      insight: t("insight"),
      subtitle: t("subtitle"),
      eyebrow: t("eyebrow"),
      footer: t("footer"),
      notes: s.notes,
    } satisfies SlideSpecOut;
  });
}

/* ----------------------------------------------------------- spec → IR 槽位 */

export function specToSlots(spec: SlideSpecOut, layout: LayoutId): Record<string, SlotContent> {
  const slots: Record<string, SlotContent> = {};
  const put = (id: string, c: SlotContent) => {
    slots[id] = c;
  };

  const text = (v?: string) => (v && v.trim() ? { kind: "text" as const, text: v.trim() } : null);

  switch (layout) {
    case "cover": {
      const e = text(spec.eyebrow);
      if (e) put("eyebrow", e);
      put("title", { kind: "text", text: spec.title });
      const st = text(spec.subtitle);
      if (st) put("subtitle", st);
      const f = text(spec.footer);
      if (f) put("footer", f);
      break;
    }
    case "toc":
    case "bullets": {
      put("title", { kind: "text", text: spec.title });
      const b = spec.bullets?.filter((x) => x.trim());
      put("body", b?.length ? { kind: "bullets", items: b } : { kind: "text", text: spec.insight ?? spec.title });
      break;
    }
    case "section": {
      const e = text(spec.eyebrow);
      if (e) put("eyebrow", e);
      put("title", { kind: "text", text: spec.title });
      const st = text(spec.subtitle);
      if (st) put("subtitle", st);
      break;
    }
    case "twocol": {
      put("title", { kind: "text", text: spec.title });
      if (spec.leftTitle) put("leftTitle", { kind: "text", text: spec.leftTitle });
      put("leftBody", {
        kind: "bullets",
        items: (spec.leftBody?.filter((x) => x.trim()) ?? ["—"]).slice(0, 6),
      });
      if (spec.rightTitle) put("rightTitle", { kind: "text", text: spec.rightTitle });
      put("rightBody", {
        kind: "bullets",
        items: (spec.rightBody?.filter((x) => x.trim()) ?? ["—"]).slice(0, 6),
      });
      break;
    }
    case "image": {
      put("title", { kind: "text", text: spec.title });
      put("image", { kind: "image", src: null, alt: spec.imageAlt ?? "示意图" });
      put("body", {
        kind: "text",
        text: spec.bullets?.join("；") || spec.insight || "（待补充正文）",
      });
      break;
    }
    case "data": {
      put("title", { kind: "text", text: spec.title });
      if (spec.chart) {
        put("chart", { kind: "chart", chart: spec.chart, insight: spec.chart.insight });
      } else if (spec.kpi?.length) {
        put("kpi", { kind: "kpi", items: spec.kpi });
      }
      if (spec.insight) put("insight", { kind: "text", text: spec.insight });
      break;
    }
    case "closing": {
      put("title", { kind: "text", text: spec.title });
      const st = text(spec.subtitle);
      if (st) put("subtitle", st);
      const f = text(spec.footer);
      if (f) put("footer", f);
      break;
    }
  }
  return slots;
}

/** 组装最终 Deck（layoutAssign 在其中真正跑） */
export function assembleDeck(
  specs: SlideSpecOut[],
  opts: { topic: string; themeId: string }
): { deck: Deck; choices: ReturnType<typeof assignLayout>[] } {
  const theme = getTheme(opts.themeId);
  const now = new Date().toISOString();
  const choices: ReturnType<typeof assignLayout>[] = [];

  const slides: Slide[] = specs.map((spec, i) => {
    const choice = assignLayout(spec as SlideSpec);
    choices.push(choice);
    const layout = choice.layout;
    const warnings: string[] = [];
    if (choice.score < 0.5) warnings.push(`版式契合度偏低：${choice.reason}`);
    if (spec.selfCheck) warnings.push(`模型自检：${spec.selfCheck}`);

    return {
      id: `s${i + 1}`,
      layout,
      slots: specToSlots(spec, layout),
      notes: spec.notes ?? "",
      warnings,
    };
  });

  const deck: Deck = {
    schemaVersion: "1.0",
    meta: {
      title: opts.topic,
      size: "16:9",
      templateId: theme.id,
      themeId: theme.id,
      locale: "zh-CN",
      createdAt: now,
      updatedAt: now,
    },
    theme: theme.tokens,
    slides,
  };

  return { deck, choices };
}

/* ---------------------------------------------------------------- 五步执行 */

const SYS_BRIEF = `你是资深演示文稿策划。根据主题判断受众、场景、时长、页数、语言、风格与核心信息。
只输出 JSON，字段：audience, scenario, durationMin(整数), slideCount(整数), language("zh-CN"|"en-US"), style, coreMessage。`;

const SYS_OUTLINE = `你是资深演示文稿策划。为给定主题产出大纲。
硬性要求：
1. 每页标题必须是**完整的行动式陈述句**（有主谓、表达判断），不能是"背景/现状/展望/介绍"这类名词短语；
2. 页数与结构：封面(cover)、目录(toc)、若干内容页、结尾(closing)，内容页里至少一个 section 作为节奏切换；
3. 只输出 JSON：{"items":[{"title","role","point"}]}，role 取 cover|toc|section|bullets|twocol|image|data|closing。`;

const SYS_SPEC = `你是资深幻灯片撰稿人。按给定大纲逐页写内容。
硬性要求：
1. 每页标题 ≤28 字且是完整陈述句；
2. 要点 ≤3 条，每条 ≤40 字；
3. 每页 notes 是演讲者备注，≥80 个汉字，口语化、可直接照读；
4. 数据页给 chart（categories + series，各系列长度必须等于 categories 长度）或 kpi（2-4 个）；
5. 只输出 JSON：{"slides":[{role,title,bullets?,leftTitle?,leftBody?,rightTitle?,rightBody?,kpi?,chart?,insight?,subtitle?,eyebrow?,footer?,imageAlt?,notes}]}`;

export async function runPipeline(opts: GenerateOptions): Promise<Deck> {
  const emit = opts.onProgress ?? (() => {});
  const cfg = getConfig();
  const mock = isMockMode(cfg);
  const themeId = opts.themeId ?? "business-navy";
  const budget = opts.maxTokens ?? cfg.maxTokens;

  let tokens = 0;
  const onUsage = (u: TokenUsage) => {
    tokens += u.totalTokens;
    emit({ type: "usage", usage: u, totalTokens: tokens });
    if (tokens > budget) {
      emit({ type: "warning", message: `已用 ${tokens} token，超过预算 ${budget}，后续请求将被截断` });
    }
  };

  // ---- 1. brief ----
  emit({ type: "step", step: "brief", message: mock ? "读取本地 fixture（mock）" : "分析受众与场景" });
  let brief: Brief;
  if (mock) {
    brief = { ...MOCK_BRIEF, slideCount: opts.slideCount ?? MOCK_BRIEF.slideCount };
  } else {
    try {
      brief = await chatJson(briefSchema, {
        system: SYS_BRIEF,
        user: `主题：${opts.topic}\n目标页数：${opts.slideCount ?? 10}`,
        onUsage,
      });
    } catch (e) {
      emit({ type: "warning", message: `brief 步骤失败，使用默认值：${(e as Error).message}` });
      brief = { ...MOCK_BRIEF, slideCount: opts.slideCount ?? 10 };
    }
  }

  const count = opts.slideCount ?? brief.slideCount;

  // ---- 2. outline ----
  emit({ type: "step", step: "outline", message: "生成大纲" });
  let outline: OutlineItem[];
  if (opts.outline?.length) {
    outline = opts.outline;
    emit({ type: "step", step: "outline", message: `沿用用户确认的 ${outline.length} 页大纲` });
  } else if (mock) {
    outline = mockOutline(opts.topic, count);
  } else {
    try {
      const r = await chatJson(outlineSchema, {
        system: SYS_OUTLINE,
        user: `主题：${opts.topic}\n受众：${brief.audience}\n场景：${brief.scenario}\n页数：${count}\n核心信息：${brief.coreMessage}`,
        onUsage,
      });
      outline = r.items;
    } catch (e) {
      emit({ type: "warning", message: `outline 失败，退回结构化模板：${(e as Error).message}` });
      outline = mockOutline(opts.topic, count);
    }
  }

  // ---- 3. slideSpec（逐页）----
  emit({ type: "step", step: "slideSpec", message: `逐页填充内容（共 ${outline.length} 页）` });
  let specs: SlideSpecOut[];
  if (mock) {
    specs = mockSpecs(opts.topic, count);
  } else {
    try {
      const r = await chatJson(slideSpecSchema, {
        system: SYS_SPEC,
        user: `主题：${opts.topic}\n受众：${brief.audience}\n核心信息：${brief.coreMessage}\n大纲：${JSON.stringify(
          outline
        )}`,
        onUsage,
      });
      specs = r.slides;
    } catch (e) {
      // 降级：标题 + 要点，并逐页打 warning（绝不静默出空页）
      emit({
        type: "warning",
        message: `内容生成失败，已降级为「标题 + 要点」：${(e as Error).message}`,
      });
      specs = outline.map((o) => ({
        role: o.role,
        title: o.title,
        bullets: [o.point || "（内容生成失败，请手动补充）"],
        notes: `${o.title}。${o.point ?? ""}（本页由降级路径生成，备注需人工补足到 80 字以上。）`,
        selfCheck: "内容生成失败已降级",
      }));
    }
  }

  // ---- 4. layoutAssign（规则引擎，模型不参与）----
  emit({ type: "step", step: "layoutAssign", message: "按内容形状分配版式（规则引擎）" });
  const { deck, choices } = assembleDeck(specs, { topic: opts.topic, themeId });

  deck.slides.forEach((s, i) => {
    emit({ type: "slide", index: i, total: deck.slides.length, title: s.id, layout: s.layout });
  });

  // ---- 5. selfCheck（本地校验器，纯函数）----
  emit({ type: "step", step: "selfCheck", message: "本地校验：字数/溢出/空洞词/备注" });
  const issues = checkDeck(deck);

  // 把校验结果写回每页 warnings，保证 UI 可见
  for (const issue of issues) {
    const slide = deck.slides.find((s) => s.id === issue.slideId);
    if (!slide) continue;
    slide.warnings = [...slide.warnings, `${issue.severity === "error" ? "错误" : "提示"}：${issue.message}`];
  }

  emit({ type: "done", deck, issues });
  return deck;
}

export { LlmError };
