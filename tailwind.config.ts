import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 语义色，全部映射到 CSS 变量（见 globals.css），换肤只改变量
        card: "rgb(var(--surface-card) / <alpha-value>)",
        page: "rgb(var(--surface-page) / <alpha-value>)",
        sunken: "rgb(var(--surface-sunken) / <alpha-value>)",
        strong: "rgb(var(--text-strong) / <alpha-value>)",
        body: "rgb(var(--text-body) / <alpha-value>)",
        muted: "rgb(var(--text-muted) / <alpha-value>)",
        faint: "rgb(var(--text-faint) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        "line-strong": "rgb(var(--line-strong) / <alpha-value>)",
        brand: "rgb(var(--brand) / <alpha-value>)",
        "brand-strong": "rgb(var(--brand-strong) / <alpha-value>)",
        "brand-soft": "rgb(var(--brand-soft) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        ok: "rgb(var(--ok) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        // 兼容旧类名：ink-* 映射到同一套 token，避免历史页面改色失效
        ink: {
          900: "rgb(var(--text-strong) / <alpha-value>)",
          700: "rgb(var(--text-body) / <alpha-value>)",
          500: "rgb(var(--text-muted) / <alpha-value>)",
          300: "rgb(var(--text-faint) / <alpha-value>)",
          100: "rgb(var(--line) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-ui-zh)", "system-ui", "sans-serif"],
        slide: ["var(--font-slide-zh)", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },
      borderRadius: {
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 260ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
