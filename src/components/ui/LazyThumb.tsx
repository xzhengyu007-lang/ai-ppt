"use client";

/**
 * 懒渲染缩略图。
 *
 * 为什么需要：模板墙每套模板都是一整页真实渲染的 DOM，24 套直接把首页 HTML 推到 80KB+，
 * 手机上首屏会明显变卡。这里先渲染一个纯色占位（几乎零成本、且是服务端同构输出的），
 * 等卡片进入视口附近才挂载真正的幻灯片 DOM。
 *
 * 副产品：占位块用主题色，滚动时的"逐块点亮"观感比一次性全部出现更好。
 */
import { useEffect, useRef, useState } from "react";
import { SlideFrame } from "@/components/slide/SlideCanvas";
import type { ResolvedSlide } from "@/lib/layout/resolve";

export function LazyThumb({
  slide,
  scale,
  background,
  accent,
}: {
  slide: ResolvedSlide;
  scale: number;
  /** 占位块底色（主题 background，不带 #） */
  background: string;
  /** 占位时的点缀色（主题 accent，不带 #） */
  accent: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setMounted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      // 提前 240px 挂载，滚动到时已经渲染好了
      { rootMargin: "240px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const w = Math.round(slide.width * scale);
  const h = Math.round(slide.height * scale);

  return (
    <div
      ref={ref}
      style={{ width: w, height: h, background: `#${background}` }}
      className="relative overflow-hidden rounded-[3px] ring-1 ring-black/5 shadow-sm"
    >
      {mounted ? (
        <SlideFrame slide={slide} scale={scale} />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <span
            className="block h-1.5 w-8 rounded-full opacity-70"
            style={{ background: `#${accent}` }}
          />
        </div>
      )}
    </div>
  );
}
