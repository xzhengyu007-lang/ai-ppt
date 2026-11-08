"use client";

/**
 * 运行时数据层 —— 同一套页面既能跑服务端，也能跑纯静态站。
 *
 * - **服务端模式**（pnpm dev / pnpm start / Vercel）：走 /api/*，Key 留在服务端。
 * - **静态模式**（GitHub Pages，NEXT_PUBLIC_STATIC=1）：没有服务器，全部在浏览器里跑：
 *   生成走本地的 mock 流水线（**不可能带真实 Key —— 这正是密钥红线的必然结果**），
 *   草稿存 localStorage，导出本来就在浏览器完成。
 *
 * 页面只调这里，不再直接 fetch("/api/...")，于是两种部署共用一份 UI 代码。
 */
import type { Deck } from "@/lib/ir/schema";
import { getTheme } from "@/lib/theme/themes";
import { buildMockDeck } from "@/lib/fixtures/mock-deck";
import { runPipeline } from "@/lib/llm/pipeline";
import type { OutlineItem } from "@/lib/llm/pipeline";

/**
 * 是否静态构建。
 *
 * 注意：这里**必须**写成字面量 `process.env.NEXT_PUBLIC_STATIC`。
 * Next 只在编译期替换字面量形式的 NEXT_PUBLIC_* 变量；
 * 一旦改成 process.env["NEXT_PUBLIC_STATIC"] 或间接读取，就永远不会被替换，
 * 静态站里会误判成服务端模式并去请求 /api（已踩过）。
 */
export function isStaticBuild(): boolean {
  return process.env.NEXT_PUBLIC_STATIC === "1";
}

/* ------------------------------------------------------------------ 类型 */

export interface ConnectivityInfo {
  provider: string;
  baseUrl: string;
  model: string;
  mock: boolean;
  hasKey: boolean;
}

export interface ConnectivityTest {
  ok: boolean;
  mock: boolean;
  model: string;
  latencyMs: number;
  message: string;
}

export interface DeckSummary {
  id: string;
  title: string;
  themeId: string;
  slideCount: number;
  updatedAt: string;
}

/** 页面侧的大纲条目（point 可省略，进入流水线时再补齐） */
export interface OutlineItemInput {
  title: string;
  role: string;
  point?: string;
}

/** 与 route handler 的 SSE 事件结构一致，页面不必区分模式 */
export type StreamEvent =
  | { type: "step"; message: string }
  | { type: "slide"; index: number; total: number; layout: string }
  | { type: "warning"; message: string }
  | { type: "usage"; totalTokens: number }
  | { type: "saved"; id: string }
  | { type: "error"; message: string };

/* -------------------------------------------------------------- 本地存储 */

const INDEX_KEY = "aippt:index";
const DECK_KEY = (id: string) => `aippt:deck:${id}`;

function readIndex(): DeckSummary[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? "[]") as DeckSummary[];
  } catch {
    return [];
  }
}

function writeIndex(list: DeckSummary[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list.slice(0, 60)));
}

function localSave(deck: Deck, id?: string): string {
  const deckId = id ?? `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  localStorage.setItem(DECK_KEY(deckId), JSON.stringify(deck));
  const list = readIndex().filter((d) => d.id !== deckId);
  list.unshift({
    id: deckId,
    title: deck.meta.title,
    themeId: deck.meta.themeId,
    slideCount: deck.slides.length,
    updatedAt: deck.meta.updatedAt,
  });
  writeIndex(list);
  return deckId;
}

/* ------------------------------------------------------------ 连通性/配置 */

export async function fetchConnectivity(): Promise<ConnectivityInfo> {
  if (isStaticBuild()) {
    return {
      provider: "mock",
      baseUrl: "",
      model: "",
      mock: true,
      hasKey: false,
    };
  }
  const r = await fetch("/api/connectivity");
  return (await r.json()) as ConnectivityInfo;
}

export async function testConnectivity(): Promise<ConnectivityTest> {
  if (isStaticBuild()) {
    return {
      ok: true,
      mock: true,
      model: "mock",
      latencyMs: 0,
      message: "静态演示版：无服务器，固定使用本地 fixture（真实模型请自托管或部署到 Vercel）",
    };
  }
  const r = await fetch("/api/connectivity", { method: "POST" });
  return (await r.json()) as ConnectivityTest;
}

/* ------------------------------------------------------------------ 草稿 */

export async function listDecks(): Promise<DeckSummary[]> {
  if (isStaticBuild()) return readIndex();
  const r = await fetch("/api/decks");
  const d = (await r.json()) as { decks?: DeckSummary[] };
  return d.decks ?? [];
}

export async function getDeck(id: string): Promise<Deck | null> {
  if (isStaticBuild()) {
    const raw = localStorage.getItem(DECK_KEY(id));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Deck;
    } catch {
      return null;
    }
  }
  const r = await fetch(`/api/decks/${encodeURIComponent(id)}`);
  if (!r.ok) return null;
  const d = (await r.json()) as { deck?: Deck };
  return d.deck ?? null;
}

export async function createDeck(deck: Deck): Promise<string> {
  if (isStaticBuild()) return localSave(deck);
  const r = await fetch("/api/decks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deck }),
  });
  const d = (await r.json()) as { id?: string; error?: string };
  if (!d.id) throw new Error(d.error ?? "保存失败");
  return d.id;
}

/** 静态模式下建一份本地样例并返回 id */
export async function createSampleDeck(topic: string, themeId: string, slideCount: number): Promise<string> {
  const deck = buildMockDeck({ topic, themeId, slideCount });
  return createDeck(deck);
}

export async function updateDeck(id: string, deck: Deck): Promise<string> {
  if (isStaticBuild()) {
    localSave(deck, id);
    return deck.meta.updatedAt;
  }
  const r = await fetch(`/api/decks/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deck }),
  });
  const d = (await r.json()) as { savedAt?: string; error?: string };
  if (!d.savedAt) throw new Error(d.error ?? "保存失败");
  return d.savedAt;
}

/* ------------------------------------------------------------------ 生成 */

export async function requestOutline(
  topic: string,
  themeId: string,
  slideCount: number
): Promise<OutlineItemInput[]> {
  if (isStaticBuild()) {
    const deck = buildMockDeck({ topic, themeId, slideCount });
    return deck.slides.map((s) => ({
      title: s.slots.title?.kind === "text" ? s.slots.title.text : topic,
      role: s.layout as OutlineItem["role"],
      point: s.notes.slice(0, 60),
    }));
  }
  const r = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ stage: "outline", topic, themeId, slideCount }),
  });
  const d = (await r.json()) as { outline?: OutlineItem[]; error?: string };
  if (d.error) throw new Error(d.error);
  return d.outline ?? [];
}

/**
 * 第二段：生成整套。
 * 服务端模式读 SSE；静态模式直接跑同一个 runPipeline，把同样的进度事件回调出去。
 */
export async function streamGenerate(
  opts: { topic: string; themeId: string; slideCount: number; outline: OutlineItemInput[] },
  onEvent: (e: StreamEvent) => void
): Promise<string> {
  if (isStaticBuild()) {
    const deck = await runPipeline({
      topic: opts.topic,
      themeId: opts.themeId,
      slideCount: opts.slideCount,
      outline: opts.outline.length
        ? opts.outline.map((o) => ({
            title: o.title,
            role: o.role as OutlineItem["role"],
            point: o.point ?? "",
          }))
        : undefined,
      onProgress: (e) => {
        if (e.type === "step") onEvent({ type: "step", message: e.message });
        else if (e.type === "slide")
          onEvent({ type: "slide", index: e.index, total: e.total, layout: String(e.layout) });
        else if (e.type === "warning") onEvent({ type: "warning", message: e.message });
        else if (e.type === "usage") onEvent({ type: "usage", totalTokens: e.totalTokens });
      },
    });
    const id = localSave(deck);
    onEvent({ type: "saved", id });
    return id;
  }

  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ stage: "deck", ...opts }),
  });
  if (!res.body) throw new Error("服务端没有返回数据流");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let deckId: string | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const chunks = buf.split("\n\n");
    buf = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const evt = JSON.parse(line.slice(6)) as StreamEvent;
      if (evt.type === "saved") deckId = evt.id;
      onEvent(evt);
    }
  }
  if (!deckId) throw new Error("生成结束但没有拿到草稿 ID");
  return deckId;
}

/** 单页重生成 */
export async function regenerateSlide(topic: string, themeId: string, title: string, role: string) {
  if (isStaticBuild()) {
    const deck = await runPipeline({
      topic,
      themeId,
      slideCount: 1,
      outline: [{ title, role: role as OutlineItem["role"], point: "" }],
    });
    const slide = deck.slides[0];
    if (!slide) throw new Error("流水线没有产出页面");
    return slide;
  }
  const res = await fetch("/api/regenerate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topic, themeId, outline: [{ title, role, point: "" }] }),
  });
  const d = (await res.json()) as { slide?: Deck["slides"][number]; error?: string };
  if (!d.slide) throw new Error(d.error ?? "重生成失败");
  return d.slide;
}

/** 静态站的编辑器链接（服务端模式保持 /editor/<id>） */
export function editorHref(id: string): string {
  return `/editor?id=${encodeURIComponent(id)}`;
}

export { getTheme };
