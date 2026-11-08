"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SlideFrame } from "@/components/slide/SlideCanvas";
import { buildLayoutCoverageDeck, buildMockDeck } from "@/lib/fixtures/mock-deck";
import { resolveDeck, resolveSlide } from "@/lib/layout/resolve";
import { THEMES } from "@/lib/theme/themes";
import { deckSchema, type Deck } from "@/lib/ir/schema";

interface OutlineItem {
  title: string;
  role: string;
  point?: string;
}

interface RecentDeck {
  id: string;
  title: string;
  themeId: string;
  slideCount: number;
  updatedAt: string;
}

export default function HomePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("2026 年 Q3 业务复盘");
  const [themeId, setThemeId] = useState("business-navy");
  const [slideCount, setSlideCount] = useState(10);

  const [stage, setStage] = useState<"idle" | "outline" | "deck">("idle");
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [progress, setProgress] = useState<string[]>([]);
  const [tokenUsed, setTokenUsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentDeck[]>([]);
  const [isMock, setIsMock] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/connectivity")
      .then((r) => r.json())
      .then((c) => setIsMock(Boolean(c.mock)))
      .catch(() => setIsMock(true));
    fetch("/api/decks")
      .then((r) => r.json())
      .then((d) => setRecent(d.decks ?? []))
      .catch(() => {});
  }, []);

  // 模板墙缩略图：真实渲染，不用占位图
  const thumbs = useMemo(
    () =>
      THEMES.map((t) => {
        const deck = buildLayoutCoverageDeck(t.id);
        const cover = deck.slides.find((s) => s.layout === "cover")!;
        return { theme: t, slide: resolveSlide(deck, cover) };
      }),
    []
  );

  async function generateOutline() {
    setError(null);
    setProgress([]);
    setStage("outline");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage: "outline", topic, themeId, slideCount }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOutline(data.outline ?? []);
      if (data.mock) setIsMock(true);
    } catch (e) {
      setError((e as Error).message);
      setStage("idle");
    }
  }

  async function generateDeck() {
    setError(null);
    setProgress([]);
    setTokenUsed(0);
    setStage("deck");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage: "deck", topic, themeId, slideCount, outline }),
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
          const evt = JSON.parse(line.slice(6));
          if (evt.type === "step") setProgress((p) => [...p, `▸ ${evt.message}`]);
          if (evt.type === "slide")
            setProgress((p) => [...p, `  第 ${evt.index + 1}/${evt.total} 页 · ${evt.layout}`]);
          if (evt.type === "warning") setProgress((p) => [...p, `⚠ ${evt.message}`]);
          if (evt.type === "usage") setTokenUsed(evt.totalTokens);
          if (evt.type === "saved") deckId = evt.id;
          if (evt.type === "error") setError(evt.message);
        }
      }

      if (deckId) router.push(`/editor/${deckId}`);
      else if (!error) setError("生成结束但没有拿到草稿 ID");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStage((s) => (s === "deck" ? "idle" : s));
    }
  }

  async function quickMockDeck() {
    const deck: Deck = buildMockDeck({ topic, themeId, slideCount });
    if (!deckSchema.safeParse(deck).success) {
      setError("本地 fixture 未通过 IR 校验");
      return;
    }
    const res = await fetch("/api/decks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deck }),
    });
    const data = await res.json();
    if (data.id) router.push(`/editor/${data.id}`);
    else setError(data.error ?? "保存失败");
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      {/* 输入区 */}
      <section className="rounded-xl border border-ink-100 bg-white p-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[22px] font-semibold tracking-tight">生成一套 PPT</h1>
          <span className="text-xs text-ink-500">
            {isMock === null ? "检测中…" : isMock ? "当前为 mock 模式（无需 Key）" : "已连接模型"}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-500">
          先出大纲，你确认后再逐页生成；预览与导出读同一份 Slide IR，导出的是可编辑的 .pptx。
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_200px_120px_auto]">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="输入主题或粘贴大纲，例如：2026 年 Q3 业务复盘"
            className="h-11 rounded-lg border border-ink-100 px-3 text-sm outline-none focus:border-ink-500"
          />
          <select
            value={themeId}
            onChange={(e) => setThemeId(e.target.value)}
            className="h-11 rounded-lg border border-ink-100 px-3 text-sm"
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={5}
            max={20}
            value={slideCount}
            onChange={(e) => setSlideCount(Number(e.target.value))}
            className="h-11 rounded-lg border border-ink-100 px-3 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={generateOutline}
              disabled={stage !== "idle"}
              className="h-11 rounded-lg bg-ink-900 px-4 text-sm font-medium text-white disabled:opacity-40"
            >
              生成大纲
            </button>
            <button
              onClick={quickMockDeck}
              className="h-11 rounded-lg border border-ink-100 px-4 text-sm hover:bg-ink-100"
              title="直接用本地 fixture 建一份，不调模型"
            >
              本地样例
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 大纲确认 */}
        {outline.length > 0 && (
          <div className="mt-6 rounded-lg border border-ink-100">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5">
              <span className="text-sm font-medium">第一步：确认大纲（可改标题、增删页）</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOutline((o) => [...o, { title: "新的一页", role: "bullets" }])}
                  className="text-xs text-ink-500 hover:text-ink-900"
                >
                  + 加一页
                </button>
                <button
                  onClick={generateDeck}
                  disabled={stage === "deck"}
                  className="h-8 rounded-md bg-ink-900 px-3 text-xs font-medium text-white disabled:opacity-40"
                >
                  {stage === "deck" ? "生成中…" : "确认并生成整套"}
                </button>
              </div>
            </div>
            <ul className="divide-y divide-ink-100">
              {outline.map((item, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-6 text-xs text-ink-300">{i + 1}</span>
                  <span className="w-20 rounded bg-ink-100 px-1.5 py-0.5 text-center text-[10px] text-ink-700">
                    {item.role}
                  </span>
                  <input
                    value={item.title}
                    onChange={(e) =>
                      setOutline((o) =>
                        o.map((x, xi) => (xi === i ? { ...x, title: e.target.value } : x))
                      )
                    }
                    className="flex-1 rounded border border-transparent px-2 py-1 text-sm hover:border-ink-100 focus:border-ink-500 focus:outline-none"
                  />
                  <button
                    onClick={() => setOutline((o) => o.filter((_, xi) => xi !== i))}
                    className="text-xs text-ink-300 hover:text-red-600"
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 进度 */}
        {progress.length > 0 && (
          <div className="mt-4 max-h-56 overflow-auto rounded-lg bg-ink-900 p-3 font-mono text-[11px] leading-5 text-green-300">
            {progress.map((p, i) => (
              <div key={i}>{p}</div>
            ))}
            {tokenUsed > 0 && <div className="text-ink-300">token 用量：{tokenUsed}</div>}
          </div>
        )}
      </section>

      {/* 模板墙 */}
      <section className="mt-10">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-semibold tracking-tight">12 套模板</h2>
          <span className="text-xs text-ink-300">缩略图是真实渲染，不是占位图</span>
          <Link href="/templates" className="ml-auto text-sm text-ink-500 hover:text-ink-900">
            查看全部 8 个版式 →
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {thumbs.map(({ theme, slide }) => (
            <button
              key={theme.id}
              onClick={() => setThemeId(theme.id)}
              className={`group overflow-hidden rounded-lg border text-left transition ${
                themeId === theme.id
                  ? "border-ink-900 ring-1 ring-ink-900"
                  : "border-ink-100 hover:border-ink-300"
              }`}
            >
              <div className="pointer-events-none bg-ink-100">
                <SlideFrame slide={slide} scale={0.2} />
              </div>
              <div className="px-3 py-2">
                <div className="text-sm font-medium">{theme.name}</div>
                <div className="mt-0.5 line-clamp-1 text-[11px] text-ink-300">{theme.description}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 最近作品 */}
      <section className="mt-10 pb-12">
        <h2 className="text-lg font-semibold tracking-tight">最近作品</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-ink-300">还没有草稿。上面点「本地样例」可以先看一份完整的。</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100 rounded-lg border border-ink-100 bg-white">
            {recent.map((d) => (
              <li key={d.id} className="flex items-center gap-4 px-4 py-3">
                <Link href={`/editor/${d.id}`} className="flex-1 truncate text-sm hover:underline">
                  {d.title}
                </Link>
                <span className="text-xs text-ink-300">{d.slideCount} 页</span>
                <span className="text-xs text-ink-300">{d.themeId}</span>
                <span className="text-xs text-ink-300">
                  {new Date(d.updatedAt).toLocaleString("zh-CN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
