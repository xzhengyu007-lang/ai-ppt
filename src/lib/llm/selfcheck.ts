/**
 * selfCheck 的**本地校验器**部分 —— 纯函数、可单测、不花 token。
 *
 * 分工（任务书 5.3）：模型负责"逻辑与重复"的自检，本地校验器负责可量化的部分。
 * 这里把可量化的做到最严：字数预算、空洞词、备注长度、标题是否行动式。
 *
 * 一条原则：**不静默失败**。所有问题都带 severity 与位置，UI 可见、可修。
 */
import type { Deck, Slide } from "@/lib/ir/schema";
import { getLayout } from "@/lib/layout/definitions";
import { plainTextOf } from "@/lib/layout/resolve";

export type Severity = "error" | "warning";

export interface Issue {
  slideId: string;
  slot: string;
  severity: Severity;
  code: string;
  message: string;
}

/** 空洞词表：出现在标题/要点里基本等于没信息量 */
export const HOLLOW_WORDS = [
  "赋能",
  "抓手",
  "闭环",
  "生态位",
  "护城河",
  "深度融合",
  "提质增效",
  "全方位",
  "多维度",
  "顶层设计",
  "组合拳",
  "打法",
];

/** 名词短语式标题（不满足"行动式完整陈述句"） */
const NOUNISH_PREFIX = ["背景", "现状", "展望", "介绍", "概述", "小结", "总结", "目录", "附录"];

/** 备注字数下限（任务书：≥80 字） */
export const MIN_NOTES_CHARS = 80;

function cjkLen(s: string): number {
  return [...s].length;
}

export function checkSlide(slide: Slide): Issue[] {
  const issues: Issue[] = [];
  const layout = getLayout(slide.layout);

  // 1. 备注长度
  if (cjkLen(slide.notes.trim()) < MIN_NOTES_CHARS) {
    issues.push({
      slideId: slide.id,
      slot: "notes",
      severity: "warning",
      code: "notes-too-short",
      message: `备注只有 ${cjkLen(slide.notes.trim())} 字，建议 ≥${MIN_NOTES_CHARS} 字`,
    });
  }

  // 2. 必需槽位缺失
  for (const slot of layout.slots) {
    if (slot.required && !slide.slots[slot.id]) {
      issues.push({
        slideId: slide.id,
        slot: slot.id,
        severity: "error",
        code: "missing-required-slot",
        message: `缺少必需内容：${slot.id}`,
      });
    }
  }

  // 3. 字数预算 + 空洞词
  for (const [slotId, content] of Object.entries(slide.slots)) {
    const def = layout.slots.find((s) => s.id === slotId);
    const text = plainTextOf(content);
    const len = cjkLen(text);

    if (def?.maxChars !== undefined && len > def.maxChars) {
      issues.push({
        slideId: slide.id,
        slot: slotId,
        severity: "error",
        code: "over-char-budget",
        message: `${slotId} 超字数：${len} / ${def.maxChars}`,
      });
    }

    const hits = HOLLOW_WORDS.filter((w) => text.includes(w));
    if (hits.length) {
      issues.push({
        slideId: slide.id,
        slot: slotId,
        severity: "warning",
        code: "hollow-words",
        message: `${slotId} 含空洞词：${hits.join("、")}`,
      });
    }
  }

  // 4. 标题是否行动式（只对标题类版式检查）
  const titleContent = slide.slots.title;
  if (titleContent?.kind === "text") {
    const t = titleContent.text.trim();
    const pref = NOUNISH_PREFIX.find((p) => t.startsWith(p));
    if (pref) {
      issues.push({
        slideId: slide.id,
        slot: "title",
        severity: "warning",
        code: "noun-phrase-title",
        message: `标题以"${pref}"开头，建议改成完整陈述句（行动式标题）`,
      });
    }
    if (t.length > 0 && !/[。！？：；，、,.!?:;]/.test(t) && cjkLen(t) < 8) {
      issues.push({
        slideId: slide.id,
        slot: "title",
        severity: "warning",
        code: "title-too-short",
        message: "标题过短，信息量不足",
      });
    }
  }

  // 5. KPI / 图表数据自洽
  const chart = slide.slots.chart;
  if (chart?.kind === "chart") {
    const n = chart.chart.categories.length;
    for (const s of chart.chart.series) {
      if (s.values.length !== n) {
        issues.push({
          slideId: slide.id,
          slot: "chart",
          severity: "error",
          code: "chart-shape-mismatch",
          message: `系列 ${s.name} 有 ${s.values.length} 个值，分类有 ${n} 个`,
        });
      }
    }
  }

  return issues;
}

export function checkDeck(deck: Deck): Issue[] {
  const issues: Issue[] = [];
  for (const s of deck.slides) issues.push(...checkSlide(s));

  // 整册级：重复标题
  const seen = new Map<string, string>();
  for (const s of deck.slides) {
    const t = s.slots.title?.kind === "text" ? s.slots.title.text.trim() : "";
    if (!t) continue;
    if (seen.has(t)) {
      issues.push({
        slideId: s.id,
        slot: "title",
        severity: "warning",
        code: "duplicate-title",
        message: `与 ${seen.get(t)} 标题重复`,
      });
    } else {
      seen.set(t, s.id);
    }
  }

  // 整册级：连续内容页过多
  let run = 0;
  for (const s of deck.slides) {
    if (s.layout === "section") {
      run = 0;
      continue;
    }
    if (["bullets", "twocol", "data", "image"].includes(s.layout)) {
      run++;
      if (run === 6) {
        issues.push({
          slideId: s.id,
          slot: "-",
          severity: "warning",
          code: "no-rhythm-break",
          message: "连续 6 页内容页没有章节页，节奏偏平",
        });
      }
    }
  }

  return issues;
}

export function summarizeIssues(issues: Issue[]) {
  return {
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    total: issues.length,
  };
}
