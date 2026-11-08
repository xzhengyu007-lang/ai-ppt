"use client";

/**
 * 极小的 UI 原语集合。
 *
 * 为什么不用 shadcn/ui CLI：它需要交互式初始化，且会把一堆 Radix 依赖带进来；
 * 本项目只需要按钮/输入/卡片/徽标这几类，手写更可控（也符合"依赖克制"）。
 * 视觉规范全部来自 globals.css 的 CSS 变量 + @layer components。
 */
import type { ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
  lift,
}: {
  children: ReactNode;
  className?: string;
  lift?: boolean;
}) {
  return <div className={cx(lift ? "card-lift" : "card", className)}>{children}</div>;
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("section-label", className)}>{children}</div>;
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "danger" | "neutral" | "brand";
  children: ReactNode;
}) {
  const map: Record<typeof tone, string> = {
    ok: "bg-[rgb(236_253_245)] text-[rgb(var(--ok))] border-[rgb(204_245_224)]",
    warn: "bg-[rgb(255_250_235)] text-[rgb(var(--warn))] border-[rgb(250_230_180)]",
    danger: "bg-[rgb(254_242_242)] text-[rgb(var(--danger))] border-[rgb(250_210_210)]",
    neutral: "bg-sunken text-muted border-line",
    brand: "bg-[rgb(var(--brand-soft))] text-[rgb(var(--brand-strong))] border-[rgb(214_214_255)]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 h-6 px-2 rounded-pill border text-[11px] font-medium",
        map[tone]
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-line bg-sunken text-[10px] font-mono text-muted">
      {children}
    </kbd>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]"
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} />;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex p-0.5 rounded-[10px] bg-sunken border border-line">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          title={o.hint}
          className={cx(
            "px-3 h-7 text-[12px] rounded-[7px] transition-all duration-150",
            value === o.value
              ? "bg-card text-strong shadow-sm font-medium"
              : "text-muted hover:text-body"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      {icon && <div className="text-faint mb-3">{icon}</div>}
      <div className="text-[13px] font-medium text-body">{title}</div>
      {hint && <div className="mt-1 text-[12px] text-faint max-w-sm">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
