import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  experimental: {
    turbopackFileSystemCacheForBuild: true,
  },
};

export default nextConfig;
