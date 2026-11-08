/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pptx 生成在浏览器端完成；Node 侧的 python 校验与 eval 都是外部脚本，不参与打包
  serverExternalPackages: [],
};

export default nextConfig;
