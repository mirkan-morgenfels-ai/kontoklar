import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@portfolio/csv", "@portfolio/ratelimit"],
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
};

export default nextConfig;
