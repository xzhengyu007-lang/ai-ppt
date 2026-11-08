"use client";

import { useMemo, useState } from "react";
import { Check, Pause, Play } from "lucide-react";
import { SlideFrame } from "@/components/slide/SlideCanvas";
import { Card, SectionLabel, StatusPill, cx } from "@/components/ui";
import { LazyThumb } from "@/components/ui/LazyThumb";
import { buildLayoutCoverageDeck } from "@/lib/fixtures/mock-deck";
import { resolveDeck } from "@/lib/layout/resolve";
import { THEMES } from "@/lib/theme/themes";
import { LAYOUT_IDS } from "@/lib/ir/constants";
import { LAYOUTS } from "@/lib/layout/definitions";
import { COMPOSITION_LABELS } from "@/lib/layout/compositions";

export default function TemplatesPage() {
  const [active, setActive] = useState(THEMES[0].id);
  const [present, setPresent] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);

  // 12 套主题 × 8 个版式，全部真实渲染
  const byTheme = useMemo(() => {
    const map = new Map<string, ReturnType<typeof resolveDeck>>();
    for (const t of THEMES) map.set(t.id, resolveDeck(buildLayoutCoverageDeck(t.id)));
    return map;
  }, []);

  const theme = THEMES.find((t) => t.id === active) ?? THEMES[0];
  const slides = byTheme.get(active) ?? [];

  return (
    <div className="mx-auto max-w-[1240px] px-6 py-10">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight">模板</h1>
          <p className="mt-1.5 text-[13px] text-muted max-w-[640px]">
            十二套主题 × 八个版式，全部原创、由代码生成。版式几何是数据、主题只是 token ——
            所以换配色不会破版。
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusPill tone="neutral">12 主题 × 8 版式 = 96 个实样</StatusPill>
        </div>
      </div>

      {/* 主题选择卡 */}
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {THEMES.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => {
                setActive(t.id);
                setSlideIdx(0);
              }}
              className={cx(
                "group rounded-card border p-2.5 text-left transition-all duration-200",
                on
                  ? "border-brand ring-2 ring-[rgb(var(--brand-soft))] bg-card shadow-card"
                  : "border-line bg-card hover:border-line-strong hover:-translate-y-0.5"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-[6px] border border-black/5 shrink-0"
                  style={{
                    background: `linear-gradient(135deg, #${t.tokens.colors.sectionBg} 0 55%, #${t.tokens.colors.accent} 55% 100%)`,
                  }}
                />
                {on && <Check size={13} className="ml-auto text-brand-strong" />}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[12.5px] font-medium text-strong">{t.name}</span>
                <span className="ml-auto text-[9.5px] px-1.5 py-0.5 rounded-pill bg-sunken text-muted">
                  {COMPOSITION_LABELS[t.composition]}
                </span>
              </div>
              <div className="mt-0.5 text-[10.5px] text-faint line-clamp-1">{t.description}</div>
            </button>
          );
        })}
      </div>

      {/* 当前主题的 token 速览 */}
      <Card className="mt-5 p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <SectionLabel>当前主题</SectionLabel>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[15px] font-semibold">{theme.name}</span>
              <StatusPill tone={theme.tone === "dark" ? "neutral" : "brand"}>
                {theme.tone === "dark" ? "暗色" : "亮色"}
              </StatusPill>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {(
              [
                ["primary", theme.tokens.colors.primary],
                ["accent", theme.tokens.colors.accent],
                ["section", theme.tokens.colors.sectionBg],
                ["surface", theme.tokens.colors.surface],
                ["text", theme.tokens.colors.text1],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="text-center">
                <div
                  className="w-9 h-9 rounded-[7px] border border-black/10"
                  style={{ background: `#${v}` }}
                  title={`${k} #${v}`}
                />
                <div className="mt-1 text-[9.5px] text-faint font-mono">#{v}</div>
              </div>
            ))}
          </div>
          <div className="ml-auto grid grid-cols-2 gap-x-6 gap-y-1 text-[11.5px] text-muted">
            <div>
              中文字体 <span className="font-mono text-strong">{theme.tokens.fonts.zh}</span>
            </div>
            <div>
              行高 <span className="text-strong">{theme.tokens.lineHeight.body}</span>
            </div>
            <div>
              圆角 <span className="text-strong">{theme.tokens.radius}px</span>
            </div>
            <div>
              节奏 <span className="text-strong">{theme.tokens.rhythm.unit}px</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 8 个版式实样 */}
      <div className="mt-6 flex items-center gap-3">
        <SectionLabel>八个版式</SectionLabel>
        <span className="text-[11px] text-faint">点击任一张进入大图</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {LAYOUT_IDS.map((id, i) => {
          const slide = slides[i];
          if (!slide) return null;
          return (
            <button
              key={id}
              onClick={() => {
                setSlideIdx(i);
                setPresent(true);
              }}
              className="group overflow-hidden rounded-card border border-line bg-card text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
            >
              <div className="bg-sunken py-2.5 grid place-items-center">
                <div className="pointer-events-none">
                  <LazyThumb
                    slide={slide}
                    scale={0.21}
                    background={theme.tokens.colors.background}
                    accent={theme.tokens.colors.accent}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[12.5px] font-medium text-strong">{LAYOUTS[id].name}</span>
                <span className="font-mono text-[10px] text-faint group-hover:text-brand-strong">
                  {id}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 大图预览 */}
      {present && slides[slideIdx] && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm grid place-items-center p-6 animate-fade-up"
          onClick={() => setPresent(false)}
        >
          <div className="w-full max-w-[1100px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2 text-white/70 text-[12px]">
              <span className="chip border-white/15 bg-white/10 text-white/80">
                {theme.name} · {LAYOUTS[LAYOUT_IDS[slideIdx]].name}
              </span>
              <div className="ml-auto flex items-center gap-1">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlideIdx(i)}
                    className={cx(
                      "w-2 h-2 rounded-full transition",
                      i === slideIdx ? "bg-white" : "bg-white/30 hover:bg-white/60"
                    )}
                    aria-label={`第 ${i + 1} 页`}
                  />
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-card shadow-lift ring-1 ring-white/10">
              <SlideFrame slide={slides[slideIdx]} scale={Math.min(1088 / 1280, 1)} />
            </div>
            <div className="mt-2 text-center text-[11px] text-white/40">
              点击任意位置关闭
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
