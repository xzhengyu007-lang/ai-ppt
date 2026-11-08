import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI PPT · 模板体系 + 大模型 + 可编辑导出",
  description:
    "输入主题或大纲，选模板，调大模型生成整套幻灯片，实时预览并导出可编辑的 .pptx",
};

const NAV = [
  { href: "/", label: "首页" },
  { href: "/templates", label: "模板" },
  { href: "/settings", label: "设置" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-ink-100 bg-white/80 backdrop-blur sticky top-0 z-30">
            <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center gap-6">
              <Link href="/" className="font-semibold tracking-tight text-[15px]">
                AI PPT
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                {NAV.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="px-3 py-1.5 rounded-md text-ink-700 hover:bg-ink-100 transition"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
              <div className="ml-auto text-xs text-ink-300">
                预览与导出读同一份 Slide IR
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
