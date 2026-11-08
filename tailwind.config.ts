import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // 中文优先：预览用自托管/系统可用的思源黑体回退链，导出侧用白名单字体名
        sans: [
          "var(--font-ui-zh)",
          "Noto Sans SC",
          "Microsoft YaHei",
          "PingFang SC",
          "system-ui",
          "sans-serif",
        ],
        slide: ["var(--font-slide-zh)", "Noto Sans SC", "Microsoft YaHei", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },
      colors: {
        ink: {
          900: "#111318",
          700: "#333842",
          500: "#5b626e",
          300: "#9aa1ad",
          100: "#e6e8ec",
        },
      },
    },
  },
  plugins: [],
};

export default config;
