import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The desktop build ships `.next/standalone` as an Electron resource and boots
  // it with `process.execPath` + ELECTRON_RUN_AS_NODE. Without this the app would
  // need the entire repo `node_modules` inside the installer.
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  experimental: {
    turbopackFileSystemCacheForDev: true,
    turbopackFileSystemCacheForBuild: true,
  },
};

export default nextConfig;
