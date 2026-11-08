"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SlideFrame } from "@/components/slide/SlideCanvas";
import { resolveDeck } from "@/lib/layout/resolve";
import { useEditor } from "@/lib/store/editor";
import { THEMES } from "@/lib/theme/themes";
import { LAYOUT_IDS, type LayoutId } from "@/lib/ir/constants";
import { LAYOUTS } from "@/lib/layout/definitions";
import { recommendLayouts, type SlideSpec } from "@/lib/llm/layout-assign";
import { exportDeckPptx, exportSlidePng, downloadBlob } from "@/lib/export/client";
import type { Slide } from "@/lib/ir/schema";

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const {
    deck,
    current,
    history,
    future,
    dirty,
    savedAt,
    saving,
    init,
    selectSlide,
    setSlotText,
    setNotes,
    setLayout,
    setTheme,
    moveSlide,
    addSlide,
    removeSlide,
    replaceSlide,
    undo,
    redo,
    markSaved,
    setSaving,
  } = useEditor();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [canvasW, setCanvasW] = useState(880);
  const centerRef = useRef<HTMLDivElement>(null);
  const dragFrom = useRef<number | null>(null);

  // 载入草稿
  useEffect(() => {
    let alive = true;
    fetch(`/api/decks/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) throw new Error(d.error);
        init(d.deck);
        setLoading(false);
      })
      .catch((e) => {
        setError((e as Error).message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, init]);

  // 中栏宽度自适应
  useEffect(() => {
    const el = centerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setCanvasW(Math.max(320, Math.min(el.clientWidth - 48, 1040)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  // 自动保存（debounce 1.5s）
  const saveNow = useCallback(async () => {
    if (!deck || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/decks/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deck }),
      });
      const data = await res.json();
      if (data.savedAt) markSaved(data.savedAt);
      else setError(data.error ?? "保存失败");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [deck, dirty, id, markSaved, setSaving]);

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(saveNow, 1500);
    return () => clearTimeout(t);
  }, [dirty, saveNow]);

  const resolved = useMemo(() => (deck ? resolveDeck(deck) : []), [deck]);
  const slide = deck?.slides[current];
  const rs = resolved[current];

  // 键盘：撤销/重做/翻页
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (meta && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        if (deck) selectSlide(Math.min(current + 1, deck.slides.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        selectSlide(Math.max(current - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, deck, current, selectSlide]);

  async function doExportPptx() {
    if (!deck) return;
    setExportMsg("正在生成 pptx…");
    try {
      const r = await exportDeckPptx(deck);
      downloadBlob(r.blob, r.fileName);
      setExportMsg(
        `已导出 ${r.fileName}（${r.sizeKb} KB）${r.fixes.length ? "｜" + r.fixes.join("；") : ""}`
      );
    } catch (e) {
      setExportMsg(`导出失败：${(e as Error).message}`);
    }
  }

  async function doExportPng() {
    if (!deck) return;
    setExportMsg("正在导出 PNG…");
    try {
      const r = await exportSlidePng(deck, current);
      downloadBlob(r.blob, r.fileName);
      setExportMsg(`已导出 ${r.fileName}（${r.sizeKb} KB）`);
    } catch (e) {
      setExportMsg(`导出失败：${(e as Error).message}`);
    }
  }

  /** 单页重生成：复用同一套流水线，只跑这一页 */
  async function regenerate() {
    if (!deck || !slide) return;
    setRegenBusy(true);
    setExportMsg("正在重生成这一页…");
    try {
      const title = slide.slots.title?.kind === "text" ? slide.slots.title.text : deck.meta.title;
      const res = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topic: deck.meta.title,
          themeId: deck.meta.themeId,
          outline: [{ title, role: slide.layout, point: "" }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const newSlide = data.slide as Slide;
      replaceSlide(current, { ...newSlide, id: slide.id });
      setExportMsg("已重生成这一页（可撤销）");
    } catch (e) {
      setExportMsg(`重生成失败：${(e as Error).message}`);
    } finally {
      setRegenBusy(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-[1400px] px-6 py-10 text-sm text-ink-500">载入草稿…</div>;
  }
  if (error && !deck) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
        <Link href="/" className="mt-4 inline-block text-sm text-ink-500 hover:underline">
          ← 回首页
        </Link>
      </div>
    );
  }
  if (!deck || !slide || !rs) return null;

  const layoutDef = LAYOUTS[slide.layout];
  const spec: SlideSpec = {
    role: slide.layout as SlideSpec["role"],
    title: slide.slots.title?.kind === "text" ? slide.slots.title.text : "",
    bullets:
      slide.slots.body?.kind === "bullets"
        ? slide.slots.body.items
        : slide.slots.leftBody?.kind === "bullets"
          ? slide.slots.leftBody.items
          : undefined,
    leftBody: slide.slots.leftBody?.kind === "bullets" ? slide.slots.leftBody.items : undefined,
    rightBody: slide.slots.rightBody?.kind === "bullets" ? slide.slots.rightBody.items : undefined,
    chart: slide.slots.chart?.kind === "chart" ? slide.slots.chart.chart : undefined,
    kpi: slide.slots.kpi?.kind === "kpi" ? slide.slots.kpi.items : undefined,
    image: slide.slots.image?.kind === "image" ? {} : undefined,
  };
  const recommendations = recommendLayouts(spec);

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* 工具条 */}
      <div className="flex items-center gap-3 border-b border-ink-100 bg-white px-4 h-12 shrink-0">
        <input
          value={deck.meta.title}
          onChange={(e) => {
            // 标题改动走 store 之外的最小路径：直接改 deck 并标脏
            const d = structuredClone(deck);
            d.meta.title = e.target.value;
            useEditor.setState({ deck: d, dirty: true });
          }}
          className="w-72 rounded border border-transparent px-2 py-1 text-sm font-medium hover:border-ink-100 focus:border-ink-500 focus:outline-none"
        />
        <span className="text-xs text-ink-300">
          {saving ? "保存中…" : dirty ? "未保存" : savedAt ? `已保存 ${new Date(savedAt).toLocaleTimeString("zh-CN")}` : "已保存"}
        </span>
        <div className="ml-2 flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!history.length}
            className="rounded px-2 py-1 text-xs text-ink-700 hover:bg-ink-100 disabled:opacity-30"
            title="撤销 Ctrl+Z"
          >
            撤销
          </button>
          <button
            onClick={redo}
            disabled={!future.length}
            className="rounded px-2 py-1 text-xs text-ink-700 hover:bg-ink-100 disabled:opacity-30"
            title="重做 Ctrl+Y"
          >
            重做
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={doExportPng}
            className="h-8 rounded-md border border-ink-100 px-3 text-xs hover:bg-ink-100"
          >
            导出本页 PNG
          </button>
          <button
            onClick={() => setFullscreen((v) => !v)}
            className="h-8 rounded-md border border-ink-100 px-3 text-xs hover:bg-ink-100"
          >
            {fullscreen ? "退出全屏" : "全屏预览"}
          </button>
          <button
            onClick={doExportPptx}
            className="h-8 rounded-md bg-ink-900 px-3 text-xs font-medium text-white hover:opacity-90"
          >
            导出 .pptx
          </button>
        </div>
      </div>

      {exportMsg && (
        <div className="border-b border-ink-100 bg-amber-50 px-4 py-1.5 text-xs text-amber-800">
          {exportMsg}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* 左：页序 */}
        <aside className="w-[190px] shrink-0 overflow-auto border-r border-ink-100 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-500">页面 {deck.slides.length}</span>
            <button
              onClick={() => addSlide("bullets")}
              className="text-xs text-ink-500 hover:text-ink-900"
            >
              + 页
            </button>
          </div>
          {resolved.map((r, i) => (
            <div
              key={deck.slides[i].id}
              draggable
              onDragStart={() => (dragFrom.current = i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragFrom.current !== null && dragFrom.current !== i) {
                  moveSlide(dragFrom.current, i);
                  dragFrom.current = null;
                }
              }}
              onClick={() => selectSlide(i)}
              className={`mb-2 cursor-pointer rounded border ${
                current === i ? "border-ink-900 ring-1 ring-ink-900" : "border-ink-100"
              }`}
            >
              <div className="pointer-events-none bg-ink-100">
                <SlideFrame slide={r} scale={0.125} />
              </div>
              <div className="flex items-center justify-between px-1.5 py-1">
                <span className="text-[10px] text-ink-300">
                  {i + 1} · {slide_layout_name(deck.slides[i].layout)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSlide(i);
                  }}
                  className="text-[10px] text-ink-300 hover:text-red-600"
                >
                  删
                </button>
              </div>
            </div>
          ))}
        </aside>

        {/* 中：画布 */}
        <div
          ref={centerRef}
          className={`flex flex-1 items-start justify-center overflow-auto p-6 ${
            fullscreen ? "bg-ink-900" : "bg-[#eef0f4]"
          }`}
        >
          <div className="slide-surface shadow-lg">
            <SlideFrame slide={rs} scale={canvasW / rs.width} />
          </div>
        </div>

        {/* 右：属性 */}
        <aside className="w-[340px] shrink-0 overflow-auto border-l border-ink-100 bg-white">
          <Section title="版式">
            <select
              value={slide.layout}
              onChange={(e) => setLayout(current, e.target.value as LayoutId)}
              className="w-full rounded border border-ink-100 px-2 py-1.5 text-sm"
            >
              {LAYOUT_IDS.map((l) => (
                <option key={l} value={l}>
                  {LAYOUTS[l].name}（{l}）
                </option>
              ))}
            </select>
            <div className="mt-2 space-y-0.5">
              {recommendations
                .filter((r) => r.layout !== slide.layout)
                .slice(0, 3)
                .map((r) => (
                  <div key={r.layout} className="text-[11px] text-ink-300">
                    {r.usable ? "可换：" : "不可用："}
                    {LAYOUTS[r.layout].name} — {r.reason}
                  </div>
                ))}
            </div>
          </Section>

          <Section title="主题">
            <select
              value={deck.meta.themeId}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full rounded border border-ink-100 px-2 py-1.5 text-sm"
            >
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-ink-300">换主题只改 token，版式几何不变</p>
          </Section>

          <Section title="内容">
            {layoutDef.slots
              .filter((s) => s.accepts.includes("text") || s.accepts.includes("bullets"))
              .map((slot) => {
                const content = slide.slots[slot.id];
                if (!content) return null;
                if (content.kind === "text") {
                  return (
                    <label key={slot.id} className="mt-2 block">
                      <span className="text-[11px] text-ink-300">
                        {slot.id} · {slot.role}
                      </span>
                      <textarea
                        value={content.text}
                        onChange={(e) => setSlotText(current, slot.id, e.target.value)}
                        rows={2}
                        className="mt-0.5 w-full rounded border border-ink-100 px-2 py-1 text-sm"
                      />
                    </label>
                  );
                }
                if (content.kind === "bullets") {
                  return (
                    <label key={slot.id} className="mt-2 block">
                      <span className="text-[11px] text-ink-300">{slot.id} · 每行一条</span>
                      <textarea
                        value={content.items.join("\n")}
                        onChange={(e) => {
                          const items = e.target.value.split("\n");
                          const d = structuredClone(deck);
                          d.slides[current].slots[slot.id] = { kind: "bullets", items };
                          useEditor.setState({ deck: d, dirty: true });
                        }}
                        rows={4}
                        className="mt-0.5 w-full rounded border border-ink-100 px-2 py-1 text-sm"
                      />
                    </label>
                  );
                }
                return (
                  <div key={slot.id} className="mt-2 text-[11px] text-ink-300">
                    {slot.id}：{content.kind}（本期不支持在该面板直接编辑）
                  </div>
                );
              })}
          </Section>

          <Section title={`备注（${[...slide.notes].length} 字）`}>
            <textarea
              value={slide.notes}
              onChange={(e) => setNotes(current, e.target.value)}
              rows={6}
              className="w-full rounded border border-ink-100 px-2 py-1 text-sm"
            />
            {[...slide.notes].length < 80 && (
              <div className="mt-1 text-[11px] text-amber-700">
                建议 ≥80 字：备注几乎不占 token，但对演讲价值很高
              </div>
            )}
          </Section>

          <Section title="本页操作">
            <button
              onClick={regenerate}
              disabled={regenBusy}
              className="h-8 w-full rounded-md border border-ink-100 text-xs hover:bg-ink-100 disabled:opacity-40"
            >
              {regenBusy ? "重生成中…" : "重新生成这一页"}
            </button>
          </Section>

          {rs.warnings.length > 0 && (
            <Section title={`提示（${rs.warnings.length}）`}>
              <ul className="space-y-1">
                {rs.warnings.map((w, i) => (
                  <li key={i} className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                    {w}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}

function slide_layout_name(l: string) {
  return LAYOUTS[l as LayoutId]?.name ?? l;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-ink-100 px-4 py-3">
      <div className="mb-2 text-xs font-semibold text-ink-700">{title}</div>
      {children}
    </div>
  );
}
