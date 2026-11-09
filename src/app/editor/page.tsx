"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { getDeck, updateDeck, regenerateSlide, searchImages, type ImageHit } from "@/lib/runtime/client";

function EditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";

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
  const [imageQuery, setImageQuery] = useState("");
  const [imageHits, setImageHits] = useState<ImageHit[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageErr, setImageErr] = useState<string | null>(null);
  /** "fit" = 按容器宽高双向自适应；数字 = 用户手动缩放倍数 */
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [fitW, setFitW] = useState(880);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    版式: true,
    内容: true,
    备注: false,
  });
  const toggleSection = (k: string) => setOpenSections((s) => ({ ...s, [k]: !s[k] }));
  const centerRef = useRef<HTMLDivElement>(null);
  const dragFrom = useRef<number | null>(null);
  const canvasW = zoom === "fit" ? fitW : Math.round(1280 * zoom);

  // 载入草稿
  useEffect(() => {
    let alive = true;
    if (!id) {
      setError("链接缺少 id 参数（形如 /editor?id=xxx）");
      setLoading(false);
      return;
    }
    getDeck(id)
      .then((d) => {
        if (!alive) return;
        if (!d) throw new Error("草稿不存在，可能已被清理");
        init(d);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError((e as Error).message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, init]);

  // 中栏自适应：宽高双向取小，保证 16:9 整页可见（窗口变矮时不溢出滚动）
  useEffect(() => {
    const el = centerRef.current;
    if (!el) return;
    const pad = fullscreen ? 12 : 48;
    const measure = () => {
      const byW = el.clientWidth - pad;
      const byH = (el.clientHeight - pad) * (16 / 9);
      setFitW(Math.max(320, Math.min(byW, byH)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, fullscreen]);

  // 自动保存（debounce 1.5s）
  const saveNow = useCallback(async () => {
    if (!deck || !dirty) return;
    setSaving(true);
    try {
      const savedAt = await updateDeck(id, deck);
      markSaved(savedAt);
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

  // 键盘：撤销/重做/翻页/缩放。
  // 关键：焦点在输入控件里必须完全放行——否则在右侧文本框里按方向键会切页、Ctrl+Z 会撤销整份 deck。
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el || !el.tagName) return false;
      return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.isContentEditable
      );
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const meta = e.ctrlKey || e.metaKey;
      const k = e.key;
      if (meta && k.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (meta && (k.toLowerCase() === "y" || (k.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (k === "Escape") {
        setFullscreen(false);
      } else if (k === "0") {
        setZoom("fit");
      } else if (k === "+" || k === "=") {
        setZoom((z) => clampZoom((z === "fit" ? fitW / 1280 : z) + 0.1));
      } else if (k === "-") {
        setZoom((z) => clampZoom((z === "fit" ? fitW / 1280 : z) - 0.1));
      } else if (k === "ArrowDown" || k === "ArrowRight") {
        if (deck) selectSlide(Math.min(current + 1, deck.slides.length - 1));
      } else if (k === "ArrowUp" || k === "ArrowLeft") {
        selectSlide(Math.max(current - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, deck, current, selectSlide, fitW]);

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
      const newSlide = (await regenerateSlide(
        deck.meta.title,
        deck.meta.themeId,
        title,
        slide.layout
      )) as Slide;
      replaceSlide(current, { ...newSlide, id: slide.id });
      setExportMsg("已重生成这一页（可撤销）");
    } catch (e) {
      setExportMsg(`重生成失败：${(e as Error).message}`);
    } finally {
      setRegenBusy(false);
    }
  }

  /** 图库搜索（Wikimedia Commons，返回结果已含许可证与署名） */
  async function doSearchImages() {
    setImageBusy(true);
    setImageErr(null);
    try {
      const q = imageQuery.trim() || deck?.meta.title || "business";
      setImageHits(await searchImages(q, 9));
    } catch (e) {
      setImageErr((e as Error).message);
    } finally {
      setImageBusy(false);
    }
  }

  function attachImage(hit: ImageHit | null) {
    if (!deck) return;
    const d = structuredClone(deck);
    d.slides[current].slots.image = hit
      ? {
          kind: "image",
          src: hit.url,
          alt: hit.title,
          credit: hit.credit,
          sourceUrl: hit.sourceUrl,
          license: hit.license,
        }
      : { kind: "image", src: null, alt: "图片占位" };
    useEditor.setState({ deck: d, dirty: true });
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
    <div className="flex h-[calc(100vh-56px)] flex-col bg-page">
      {/* 工具条 */}
      <div className="flex items-center gap-3 border-b border-line bg-card/95 backdrop-blur px-4 h-14 shrink-0">
        <input
          value={deck.meta.title}
          onChange={(e) => {
            // 标题改动走 store 之外的最小路径：直接改 deck 并标脏
            const d = structuredClone(deck);
            d.meta.title = e.target.value;
            useEditor.setState({ deck: d, dirty: true });
          }}
          className="w-40 shrink-0 rounded border border-transparent px-2 py-1 text-sm font-medium hover:border-ink-100 focus:border-ink-500 focus:outline-none lg:w-72"
        />
        <span className="hidden shrink-0 text-xs text-ink-300 sm:inline">
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

        {/* 缩放：⌘/Ctrl 之外用 0 回适应、+/- 步进 */}
        <div className="ml-3 hidden shrink-0 items-center rounded-md border border-line md:flex">
          <button
            onClick={() => setZoom((z) => clampZoom((z === "fit" ? fitW / 1280 : z) - 0.1))}
            className="h-7 w-7 text-xs text-ink-500 hover:bg-ink-100"
            title="缩小 -"
          >
            −
          </button>
          <button
            onClick={() => setZoom("fit")}
            className="h-7 min-w-[52px] border-x border-line px-1.5 text-[11px] tabular-nums text-ink-700 hover:bg-ink-100"
            title="适应窗口 0"
          >
            {zoom === "fit" ? "适应" : `${Math.round(canvasW / 12.8)}%`}
          </button>
          <button
            onClick={() => setZoom((z) => clampZoom((z === "fit" ? fitW / 1280 : z) + 0.1))}
            className="h-7 w-7 text-xs text-ink-500 hover:bg-ink-100"
            title="放大 +"
          >
            +
          </button>
        </div>

        <span className="hidden shrink-0 text-[11px] tabular-nums text-ink-300 sm:inline">
          {current + 1} / {deck.slides.length}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
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
        <div className="border-b border-line bg-[rgb(255_250_235)] px-4 py-2 text-[11.5px] text-[rgb(var(--warn))]">
          {exportMsg}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* 左：页序 */}
        <aside className="w-[204px] shrink-0 overflow-auto border-r border-line bg-card p-3">
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
              className={`group relative mb-1.5 cursor-pointer overflow-hidden rounded-control border transition-all duration-150 ${
                current === i
                  ? "border-brand ring-2 ring-[rgb(var(--brand-soft))] shadow-sm"
                  : "border-ink-100 hover:border-ink-300"
              }`}
            >
              <div className="pointer-events-none bg-sunken">
                <SlideFrame slide={r} scale={0.125} />
              </div>
              <div className="flex items-center px-1.5 py-1">
                <span className="truncate text-[10px] text-ink-300">
                  {slide_layout_name(deck.slides[i].layout)}
                </span>
              </div>
              <span className="pointer-events-none absolute left-1 top-1 rounded-sm bg-ink-900/65 px-1 text-[9px] leading-4 tabular-nums text-white">
                {i + 1}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeSlide(i);
                }}
                title="删除本页"
                className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-sm bg-ink-900/65 text-[10px] leading-none text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
              >
                ×
              </button>
            </div>
          ))}
        </aside>

        {/* 中：画布 */}
        <div
          ref={centerRef}
          className={`relative flex flex-1 items-start justify-center overflow-auto p-8 ${
            fullscreen ? "bg-ink-900" : "bg-[#eef0f4]"
          }`}
        >
          <div className="slide-surface shadow-lg">
            <SlideFrame slide={rs} scale={canvasW / rs.width} />
          </div>
        </div>

        {/* 右：属性 */}
        <aside className="w-[348px] shrink-0 overflow-auto border-l border-line bg-card">
          <Section title={'版式'} open={!!openSections['版式']} onToggle={() => toggleSection('版式')}>
            <select
              value={slide.layout}
              onChange={(e) => setLayout(current, e.target.value as LayoutId)}
              className="field h-9"
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

          <Section title={'主题'} open={!!openSections['主题']} onToggle={() => toggleSection('主题')}>
            <select
              value={deck.meta.themeId}
              onChange={(e) => setTheme(e.target.value)}
              className="field h-9"
            >
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-ink-300">换主题只改 token，版式几何不变</p>
          </Section>

          <Section title={'内容'} open={!!openSections['内容']} onToggle={() => toggleSection('内容')}>
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
                        className="mt-0.5 field-area"
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
                        className="mt-0.5 field-area"
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

          {layoutDef.slots.some((s) => s.id === "image") && (
            <Section
            title="配图 · Wikimedia Commons"
            open={!!openSections["配图"]}
            onToggle={() => toggleSection("配图")}
          >
              <div className="flex gap-1.5">
                <input
                  value={imageQuery}
                  onChange={(e) => setImageQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") doSearchImages();
                  }}
                  placeholder="关键词，例如 data center"
                  className="field h-8 flex-1 text-[12px]"
                />
                <button
                  onClick={doSearchImages}
                  disabled={imageBusy}
                  className="btn-secondary h-8 px-2.5"
                >
                  {imageBusy ? "…" : "搜索"}
                </button>
              </div>

              {imageErr && (
                <div className="mt-1.5 text-[11px] text-[rgb(var(--danger))]">{imageErr}</div>
              )}

              {imageHits.length > 0 && (
                <>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {imageHits.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => attachImage(h)}
                        title={`${h.license} · ${h.author}`}
                        className="relative overflow-hidden rounded border border-line hover:border-brand"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={h.url} alt={h.title} className="h-12 w-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 text-[8px] text-white">
                          {h.license}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => attachImage(null)}
                    className="mt-1.5 text-[11px] text-muted hover:text-strong"
                  >
                    清除配图
                  </button>
                </>
              )}

              <p className="mt-1.5 text-[10.5px] leading-relaxed text-faint">
                只显示 CC0 / 公有领域 / CC BY 系；套用后署名会写进页面下方小字。
                静态站直连 Commons，服务端模式走 /api/images 代理。
              </p>
            </Section>
          )}

          <Section
            title={`备注 · ${[...slide.notes].length} 字`}
            open={!!openSections["备注"]}
            onToggle={() => toggleSection("备注")}
          >
            <textarea
              value={slide.notes}
              onChange={(e) => setNotes(current, e.target.value)}
              rows={6}
              className="field-area"
            />
            {[...slide.notes].length < 80 && (
              <div className="mt-1 text-[11px] text-amber-700">
                建议 ≥80 字：备注几乎不占 token，但对演讲价值很高
              </div>
            )}
          </Section>

          <Section title={'本页操作'} open={!!openSections['操作']} onToggle={() => toggleSection('操作')}>
            <button
              onClick={regenerate}
              disabled={regenBusy}
              className="h-8 w-full rounded-md border border-ink-100 text-xs hover:bg-ink-100 disabled:opacity-40"
            >
              {regenBusy ? "重生成中…" : "重新生成这一页"}
            </button>
          </Section>

          {rs.warnings.length > 0 && (
            <Section
            title={`提示 · ${rs.warnings.length}`}
            open={!!openSections["提示"]}
            onToggle={() => toggleSection("提示")}
          >
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

const clampZoom = (z: number) => Math.min(2, Math.max(0.25, Math.round(z * 100) / 100));

function slide_layout_name(l: string) {
  return LAYOUTS[l as LayoutId]?.name ?? l;
}

function Section({
  title,
  children,
  open,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
  onToggle?: () => void;
}) {
  const collapsible = onToggle !== undefined;
  const shown = !collapsible || open;
  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={onToggle}
        disabled={!collapsible}
        aria-expanded={collapsible ? !!open : undefined}
        className={`flex w-full items-center gap-1.5 px-4 py-2.5 text-left ${
          collapsible ? "hover:bg-ink-50" : "cursor-default"
        }`}
      >
        <span className="section-label flex-1">{title}</span>
        {collapsible && (
          <span
            className={`text-[9px] text-ink-300 transition-transform duration-150 ${
              open ? "rotate-90" : ""
            }`}
          >
            ▶
          </span>
        )}
      </button>
      {shown && <div className="px-4 pb-3.5">{children}</div>}
    </div>
  );
}

/** 静态导出要求：useSearchParams 必须包在 Suspense 里 */
export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1400px] px-6 py-10 text-sm text-muted">载入编辑器…</div>
      }
    >
      <EditorInner />
    </Suspense>
  );
}