import type { NextConfig } from "next";

// Website biasa — tidak ada `output: "standalone"` di sini. Mode itu hanya
// dibutuhkan aplikasi desktop, yang mengemas bundle-nya ke dalam installer
// Electron.
const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;
