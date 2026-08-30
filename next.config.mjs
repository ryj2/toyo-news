/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 抓取发生在 Node 运行时，避免被 Edge 打包
  serverExternalPackages: ['rss-parser'],
};

export default nextConfig;
