/**
 * Next 配置 —— 一套代码，两种部署：
 *
 *  1. 服务端模式（pnpm dev / pnpm start / Vercel）：正常 Next 应用，API 路由可用。
 *  2. 静态模式（GitHub Pages）：NEXT_PUBLIC_STATIC=1 时 output: "export"。
 *     此时没有服务器，生成走浏览器内的 mock 流水线，草稿存 localStorage。
 *     ⚠️ 静态模式**不可能**带真实模型 Key —— 这正是"密钥四不入"红线的必然结果。
 */
const isStatic = process.env.NEXT_PUBLIC_STATIC === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(isStatic
    ? {
        output: "export",
        images: { unoptimized: true },
        // GitHub Pages 是纯静态托管，目录式 URL 更稳
        trailingSlash: true,
      }
    : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
