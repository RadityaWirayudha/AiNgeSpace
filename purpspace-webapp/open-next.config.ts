import { defineCloudflareConfig } from "@opennextjs/cloudflare"

// Konfigurasi minimal untuk landing page + satu API route (/api/daftar).
// Tidak butuh R2 incremental cache karena tidak ada ISR di project ini.
export default defineCloudflareConfig()
