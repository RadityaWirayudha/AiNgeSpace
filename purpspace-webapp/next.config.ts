import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Website biasa — tidak ada `output: "standalone"` di sini. Mode itu hanya
// dibutuhkan aplikasi desktop, yang mengemas bundle-nya ke dalam installer
// Electron.
const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
};

// Mengaktifkan dev server Cloudflare Workers lokal (hanya aktif di dev mode).
initOpenNextCloudflareForDev();

export default nextConfig;
