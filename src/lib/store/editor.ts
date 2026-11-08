"use client";

/**
 * 编辑器状态 —— zustand + **快照式**撤销/重做。
 *
 * 为什么是快照式而不是命令式：换版式/换主题/页序这类结构性操作，
 * 写逆操作几乎必错；而 IR 只有十几页 JSON，structuredClone 的成本可以忽略。
 * 这一点是从 PPTist 的实现里学到的（只读参考，未拷代码）。
 */
import { create } from "zustand";
import type { Deck, Slide } from "@/lib/ir/schema";
import type { LayoutId } from "@/lib/ir/constants";
import { getTheme } from "@/lib/theme/themes";

const HISTORY_LIMIT = 30;

interface EditorState {
  deck: Deck | null;
  current: number;
  history: Deck[];
  future: Deck[];
  savedAt: string | null;
  saving: boolean;
  dirty: boolean;

  init: (deck: Deck) => void;
  selectSlide: (i: number) => void;
  setSlotText: (index: number, slotId: string, text: string) => void;
  setNotes: (index: number, notes: string) => void;
  setLayout: (index: number, layout: LayoutId) => void;
  setTheme: (themeId: string) => void;
  moveSlide: (from: number, to: number) => void;
  addSlide: (layout: LayoutId) => void;
  removeSlide: (index: number) => void;
  replaceSlide: (index: number, slide: Slide) => void;
  undo: () => void;
  redo: () => void;
  markSaved: (at: string) => void;
  setSaving: (v: boolean) => void;
}

function snapshot(deck: Deck): Deck {
  return structuredClone(deck);
}

export const useEditor = create<EditorState>((set, get) => {
  /** 统一的改动入口：先压历史，再改 */
  const mutate = (fn: (deck: Deck) => void) => {
    const { deck, history } = get();
    if (!deck) return;
    const before = snapshot(deck);
    const next = snapshot(deck);
    fn(next);
    next.meta.updatedAt = new Date().toISOString();
    set({
      deck: next,
      history: [...history, before].slice(-HISTORY_LIMIT),
      future: [],
      dirty: true,
    });
  };

  return {
    deck: null,
    current: 0,
    history: [],
    future: [],
    savedAt: null,
    saving: false,
    dirty: false,

    init: (deck) => set({ deck, current: 0, history: [], future: [], dirty: false }),

    selectSlide: (i) => {
      const { deck } = get();
      if (!deck) return;
      set({ current: Math.max(0, Math.min(i, deck.slides.length - 1)) });
    },

    setSlotText: (index, slotId, text) =>
      mutate((d) => {
        const slide = d.slides[index];
        if (!slide) return;
        const existing = slide.slots[slotId];
        if (!existing) return;
        slide.slots[slotId] =
          existing.kind === "text" ? { ...existing, text } : existing;
      }),

    setNotes: (index, notes) =>
      mutate((d) => {
        const slide = d.slides[index];
        if (slide) slide.notes = notes;
      }),

    setLayout: (index, layout) =>
      mutate((d) => {
        const slide = d.slides[index];
        if (!slide) return;
        // 换版式保留能装下的同 id 槽位内容，其余丢弃并在 warnings 里说明
        const kept: Record<string, Slide["slots"][string]> = {};
        for (const [k, v] of Object.entries(slide.slots)) kept[k] = v;
        slide.layout = layout;
        slide.slots = kept;
        slide.warnings = [
          ...slide.warnings.filter((w) => !w.startsWith("换版式")),
          `换版式为 ${layout}，原内容中不兼容的槽位已保留但可能不显示`,
        ];
      }),

    setTheme: (themeId) =>
      mutate((d) => {
        const theme = getTheme(themeId);
        d.theme = theme.tokens;
        d.meta.themeId = theme.id;
        d.meta.templateId = theme.id;
      }),

    moveSlide: (from, to) =>
      mutate((d) => {
        if (from === to) return;
        const [s] = d.slides.splice(from, 1);
        d.slides.splice(to, 0, s);
      }),

    addSlide: (layout) =>
      mutate((d) => {
        const id = `s_${Date.now().toString(36)}`;
        d.slides.push({
          id,
          layout,
          slots: { title: { kind: "text", text: "新的一页" } },
          notes: "",
          warnings: ["新建页：备注为空，建议补充"],
        });
      }),

    removeSlide: (index) =>
      mutate((d) => {
        if (d.slides.length <= 1) return;
        d.slides.splice(index, 1);
      }),

    replaceSlide: (index, slide) =>
      mutate((d) => {
        d.slides[index] = slide;
      }),

    undo: () => {
      const { history, deck, future } = get();
      if (!history.length || !deck) return;
      const prev = history[history.length - 1];
      set({
        deck: prev,
        history: history.slice(0, -1),
        future: [snapshot(deck), ...future].slice(0, HISTORY_LIMIT),
        dirty: true,
      });
    },

    redo: () => {
      const { future, deck, history } = get();
      if (!future.length || !deck) return;
      const next = future[0];
      set({
        deck: next,
        future: future.slice(1),
        history: [...history, snapshot(deck)].slice(-HISTORY_LIMIT),
        dirty: true,
      });
    },

    markSaved: (at) => set({ savedAt: at, dirty: false }),
    setSaving: (v) => set({ saving: v }),
  };
});
