"use client";

import { useMemo, useState } from "react";
import { SlideFrame } from "@/components/slide/SlideCanvas";
import { buildLayoutCoverageDeck } from "@/lib/fixtures/mock-deck";
import { resolveDeck } from "@/lib/layout/resolve";
import { THEMES } from "@/lib/theme/themes";
import { LAYOUT_IDS } from "@/lib/ir/constants";
import { LAYOUTS } from "@/lib/layout/definitions";

export default function TemplatesPage() {
  const [active, setActive] = useState(THEMES[0].id);

  // 每套主题渲染 8 个版式的真实实样
  const byTheme = useMemo(() => {
    const map = new Map<string, ReturnType<typeof resolveDeck>>();
    for (const t of THEMES) {
      map.set(t.id, resolveDeck(buildLayoutCoverageDeck(t.id)));
    }
    return map;
  }, []);

  const theme = THEMES.find((t) => t.id === active)!;
  const slides = byTheme.get(active) ?? [];

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      <h1 className="text-[22px] font-semibold tracking-tight">模板</h1>
      <p className="mt-1 text-sm text-ink-500">
        12 套主题 × 8 个版式，全部原创、由代码生成。换主题不破版：版式几何是数据，主题只是 token。
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              active === t.id
                ? "border-ink-900 bg-ink-900 text-white"
                : "border-ink-100 bg-white text-ink-700 hover:border-ink-300"
            }`}
          >
            {t.name}
            <span className="ml-1.5 opacity-60">{t.tone === "dark" ? "暗" : "亮"}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-ink-100 bg-white px-4 py-3">
        <div className="text-sm font-medium">{theme.name}</div>
        <div className="mt-0.5 text-xs text-ink-500">{theme.description}</div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-300">
          <span>主色 #{theme.tokens.colors.primary}</span>
          <span>辅色 #{theme.tokens.colors.secondary}</span>
          <span>强调 #{theme.tokens.colors.accent}</span>
          <span>中文字体 {theme.tokens.fonts.zh}</span>
          <span>圆角 {theme.tokens.radius}px</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {LAYOUT_IDS.map((id, i) => {
          const slide = slides[i];
          if (!slide) return null;
          return (
            <div key={id} className="overflow-hidden rounded-lg border border-ink-100 bg-white">
              <div className="pointer-events-none bg-ink-100">
                <SlideFrame slide={slide} scale={0.24} />
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs font-medium">{LAYOUTS[id].name}</span>
                <span className="font-mono text-[10px] text-ink-300">{id}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
