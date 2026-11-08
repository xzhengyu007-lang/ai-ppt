"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Layers,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { SlideFrame } from "@/components/slide/SlideCanvas";
import { Card, EmptyState, Kbd, SectionLabel, Spinner, StatusPill, cx } from "@/components/ui";
import { buildLayoutCoverageDeck, buildMockDeck } from "@/lib/fixtures/mock-deck";
import { resolveSlide } from "@/lib/layout/resolve";
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

const ROLE_LABEL: Record<string, string> = {
  cover: "封面",
  toc: "目录",
  section: "章节",
  bullets: "要点",
  twocol: "双栏",
  image: "图文",
  data: "数据",
  closing: "结尾",
};

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
  const [themeOpen, setThemeOpen] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    progressRef.current?.scrollTo({ top: 99999 });
  }, [progress]);

  // 模板墙缩略图：真实渲染（不是占位图）
  const thumbs = useMemo(
    () =>
      THEMES.map((t) => {
        const deck = buildLayoutCoverageDeck(t.id);
        const cover = deck.slides.find((s) => s.layout === "cover")!;
        return { theme: t, slide: resolveSlide(deck, cover) };
      }),
    []
  );

  const activeTheme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

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
            setProgress((p) => [
              ...p,
              `  ${String(evt.index + 1).padStart(2, "0")}/${evt.total} · ${evt.layout}`,
            ]);
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
    <div className="pb-20">
      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden bg-[#0b0b14] text-white">
        <div className="absolute inset-0 hero-mesh" />
        <div className="absolute inset-0 grid-lines opacity-60" />
        <div className="relative mx-auto max-w-[1240px] px-6 pt-14 pb-28">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="chip border-white/15 bg-white/10 text-white/80">
              <Sparkles size={11} /> Slide IR 单一事实源
            </span>
            <span className="chip border-white/15 bg-white/10 text-white/80">
              导出可编辑 .pptx
            </span>
            {isMock === false && (
              <span className="chip border-emerald-300/30 bg-emerald-400/10 text-emerald-200">
                已连接模型
              </span>
            )}
            {isMock === true && (
              <span className="chip border-white/15 bg-white/10 text-white/70">mock 模式</span>
            )}
          </div>

          <h1 className="mt-6 text-[40px] leading-[1.15] font-semibold tracking-tight max-w-[720px]">
            说一句主题，
            <br />
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-sky-200 bg-clip-text text-transparent">
              拿到一套能改的 PPT
            </span>
          </h1>
          <p className="mt-4 max-w-[620px] text-[13.5px] leading-relaxed text-white/65">
            先出大纲给你改，确认后再逐页生成；十二套主题、八个版式由代码生成，
            预览与导出读同一份 IR —— 导出的每一行字都能选中改写，不是截图。
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-white/50">
            <span className="flex items-center gap-1.5">
              <Check size={13} className="text-emerald-300" /> 包结构 12 项断言全过
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={13} className="text-emerald-300" /> 几何误差 ≤2px（实测 0）
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={13} className="text-emerald-300" /> 无 Key 也能跑通
            </span>
          </div>
        </div>
      </section>

      {/* ───────── 生成器（压在 hero 上） ───────── */}
      <div className="mx-auto max-w-[1240px] px-6 -mt-16 relative">
        <Card className="p-5 shadow-card animate-fade-up">
          <div className="flex items-center justify-between">
            <SectionLabel>描述你要什么</SectionLabel>
            <div className="flex items-center gap-2 text-[11px] text-faint">
              <Kbd>Enter</Kbd> 生成大纲
            </div>
          </div>

          <div className="mt-2.5">
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (stage === "idle") generateOutline();
                }
              }}
              rows={2}
              placeholder="例如：2026 年 Q3 业务复盘 —— 面向管理层，20 分钟，讲清增长质量与下一步"
              className="field-area text-[14px]"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            {/* 主题选择（带缩略色卡的下拉） */}
            <div className="relative">
              <button
                onClick={() => setThemeOpen((v) => !v)}
                className="btn-secondary pr-2.5"
                aria-haspopup="listbox"
                aria-expanded={themeOpen}
              >
                <span
                  className="w-3.5 h-3.5 rounded-[4px] border border-black/10"
                  style={{
                    background: `linear-gradient(135deg, #${activeTheme.tokens.colors.primary}, #${activeTheme.tokens.colors.accent})`,
                  }}
                />
                {activeTheme.name}
                <ChevronDown size={13} className="text-faint" />
              </button>
              {themeOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setThemeOpen(false)} />
                  <div className="absolute z-30 mt-1.5 w-[320px] max-h-[320px] overflow-auto rounded-card border border-line bg-card shadow-lift p-1.5">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setThemeId(t.id);
                          setThemeOpen(false);
                        }}
                        className={cx(
                          "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-control text-left transition",
                          themeId === t.id ? "bg-brand-soft" : "hover:bg-sunken"
                        )}
                      >
                        <span
                          className="w-7 h-5 rounded-[3px] border border-black/10 shrink-0"
                          style={{
                            background: `linear-gradient(135deg, #${t.tokens.colors.sectionBg} 0 55%, #${t.tokens.colors.accent} 55% 100%)`,
                          }}
                        />
                        <span className="min-w-0">
                          <span className="block text-[12.5px] font-medium text-strong">
                            {t.name}
                          </span>
                          <span className="block text-[11px] text-faint truncate">
                            {t.description}
                          </span>
                        </span>
                        {themeId === t.id && (
                          <Check size={14} className="ml-auto text-brand-strong shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 页数步进 */}
            <div className="flex items-center h-9 rounded-control border border-line bg-card overflow-hidden">
              <button
                onClick={() => setSlideCount((n) => Math.max(5, n - 1))}
                className="w-8 h-full text-muted hover:bg-sunken"
                aria-label="减少页数"
              >
                −
              </button>
              <span className="w-14 text-center text-[12.5px] tabular-nums text-body">
                {slideCount} 页
              </span>
              <button
                onClick={() => setSlideCount((n) => Math.min(20, n + 1))}
                className="w-8 h-full text-muted hover:bg-sunken"
                aria-label="增加页数"
              >
                +
              </button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button onClick={quickMockDeck} className="btn-ghost" title="不调模型，直接用本地样例">
                <FileText size={14} /> 本地样例
              </button>
              <button
                onClick={generateOutline}
                disabled={stage !== "idle"}
                className="btn-primary"
              >
                {stage === "outline" ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> 生成中
                  </>
                ) : (
                  <>
                    <Wand2 size={14} /> 生成大纲
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-control border border-[rgb(250_210_210)] bg-[rgb(254_242_242)] px-3 py-2 text-[12.5px] text-[rgb(var(--danger))]">
              <span className="mt-0.5">●</span>
              <span>{error}</span>
            </div>
          )}
        </Card>
      </div>

      {/* ───────── 大纲确认 ───────── */}
      {outline.length > 0 && (
        <div className="mx-auto max-w-[1240px] px-6 mt-6">
          <Card className="overflow-hidden animate-fade-up">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-line">
              <span className="w-5 h-5 rounded-full bg-brand-soft text-brand-strong text-[11px] font-semibold grid place-items-center">
                1
              </span>
              <div>
                <div className="panel-title">确认大纲</div>
                <div className="text-[11.5px] text-faint">
                  每页标题都是完整陈述句；可改标题、增删页，确认后再逐页生成
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setOutline((o) => [...o, { title: "新的一页", role: "bullets" }])}
                  className="btn-secondary"
                >
                  <Plus size={13} /> 加一页
                </button>
                <button onClick={generateDeck} disabled={stage === "deck"} className="btn-primary">
                  {stage === "deck" ? (
                    <>
                      <Spinner /> 生成中
                    </>
                  ) : (
                    <>
                      确认并生成整套 <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </div>

            <ul className="divide-y divide-line">
              {outline.map((item, i) => (
                <li key={i} className="group flex items-center gap-3 px-5 py-2 hover:bg-sunken/60">
                  <span className="w-6 text-[11px] tabular-nums text-faint">{i + 1}</span>
                  <span className="chip shrink-0">
                    {ROLE_LABEL[item.role] ?? item.role}
                  </span>
                  <input
                    value={item.title}
                    onChange={(e) =>
                      setOutline((o) =>
                        o.map((x, xi) => (xi === i ? { ...x, title: e.target.value } : x))
                      )
                    }
                    className="flex-1 bg-transparent rounded-control px-2 py-1 text-[13px] text-strong border border-transparent hover:border-line focus:border-brand focus:outline-none"
                  />
                  <button
                    onClick={() => setOutline((o) => o.filter((_, xi) => xi !== i))}
                    className="btn-danger-ghost opacity-0 group-hover:opacity-100"
                    aria-label="删除这一页"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* ───────── 生成进度 ───────── */}
      {progress.length > 0 && (
        <div className="mx-auto max-w-[1240px] px-6 mt-6">
          <div className="rounded-card overflow-hidden border border-[#1b1b26] bg-[#0e0e17]">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-2 text-[11px] text-white/40 font-mono">pipeline / generate</span>
              {tokenUsed > 0 && (
                <span className="ml-auto text-[11px] text-white/40 font-mono">
                  tokens {tokenUsed}
                </span>
              )}
            </div>
            <div
              ref={progressRef}
              className="max-h-56 overflow-auto px-4 py-3 font-mono text-[11.5px] leading-[1.7] text-emerald-300/90"
            >
              {progress.map((p, i) => (
                <div key={i} className={p.includes("⚠") ? "text-amber-300" : undefined}>
                  {p}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ───────── 模板墙 ───────── */}
      <section className="mx-auto max-w-[1240px] px-6 mt-14">
        <div className="flex items-end gap-3">
          <div>
            <h2 className="text-[19px] font-semibold tracking-tight">十二套模板</h2>
            <p className="mt-1 text-[12.5px] text-muted">
              缩略图是真实渲染；换主题只改 token，版式几何不变、不破版
            </p>
          </div>
          <Link
            href="/templates"
            className="ml-auto text-[12.5px] text-muted hover:text-strong inline-flex items-center gap-1"
          >
            查看 8 个版式 <ArrowRight size={13} />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {thumbs.map(({ theme, slide }) => {
            const active = themeId === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => setThemeId(theme.id)}
                className={cx(
                  "group relative overflow-hidden rounded-card border text-left transition-all duration-200",
                  active
                    ? "border-brand ring-2 ring-[rgb(var(--brand-soft))] shadow-card"
                    : "border-line hover:border-line-strong hover:shadow-card hover:-translate-y-0.5"
                )}
              >
                <div className="relative bg-sunken py-2.5 grid place-items-center">
                  <div className="pointer-events-none rounded-[3px] overflow-hidden ring-1 ring-black/5 shadow-sm">
                    <SlideFrame slide={slide} scale={0.2} />
                  </div>
                  {active && (
                    <span className="absolute top-2 right-2 grid place-items-center w-5 h-5 rounded-full bg-brand text-white shadow">
                      <Check size={12} />
                    </span>
                  )}
                </div>
                <div className="px-3 py-2.5 bg-card">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12.5px] font-medium text-strong">{theme.name}</span>
                    <span
                      className={cx(
                        "ml-auto text-[10px] px-1.5 py-0.5 rounded-pill",
                        theme.tone === "dark"
                          ? "bg-[#1b1b26] text-white/70"
                          : "bg-sunken text-muted"
                      )}
                    >
                      {theme.tone === "dark" ? "暗色" : "亮色"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-faint truncate">{theme.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ───────── 最近作品 ───────── */}
      <section className="mx-auto max-w-[1240px] px-6 mt-14">
        <div className="flex items-end gap-3">
          <h2 className="text-[19px] font-semibold tracking-tight">最近作品</h2>
          {recent.length > 0 && (
            <span className="chip ml-1">{recent.length} 份草稿</span>
          )}
        </div>

        {recent.length === 0 ? (
          <Card className="mt-4">
            <EmptyState
              icon={<Layers size={26} />}
              title="还没有草稿"
              hint="在上面输入一个主题，或点「本地样例」直接看一份完整的十页稿子"
            />
          </Card>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recent.map((d) => {
              const t = THEMES.find((x) => x.id === d.themeId) ?? THEMES[0];
              return (
                <Link key={d.id} href={`/editor/${d.id}`} className="group">
                  <Card lift className="p-3.5 h-full">
                    <div className="flex items-start gap-3">
                      <span
                        className="w-10 h-10 rounded-control shrink-0 border border-black/5"
                        style={{
                          background: `linear-gradient(135deg, #${t.tokens.colors.sectionBg} 0 58%, #${t.tokens.colors.accent} 58% 100%)`,
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-strong truncate group-hover:text-brand-strong">
                          {d.title}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-faint">
                          <span>{d.slideCount} 页</span>
                          <span>·</span>
                          <span>{t.name}</span>
                        </div>
                      </div>
                      <ArrowRight
                        size={14}
                        className="text-faint opacity-0 group-hover:opacity-100 transition mt-1"
                      />
                    </div>
                    <div className="mt-2.5 text-[10.5px] text-faint">
                      {new Date(d.updatedAt).toLocaleString("zh-CN")}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <footer className="mx-auto max-w-[1240px] px-6 mt-16">
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-card px-4 py-3">
          <StatusPill tone="brand">导出优先</StatusPill>
          <span className="text-[12px] text-muted">
            导出的 .pptx 通过包结构 12 项断言 + python-pptx 读回 6 项断言；预览与导出的已知差异全部记录在
            <Link href="/settings" className="text-brand-strong hover:underline mx-1">
              设置页
            </Link>
            与 docs/已知差异.md。
          </span>
        </div>
      </footer>
    </div>
  );
}
