/**
 * Tautan unduhan aplikasi desktop.
 *
 * Installernya di-host di GitHub Releases — bukan di server website. Alasannya:
 * (1) binernya ~180 MB, tidak pantas ada di git atau di aset Cloudflare Worker,
 * (2) GitHub Releases gratis untuk public repo, sudah punya CDN, dan
 *     `electron-updater` mendukungnya secara native.
 *
 * Setiap rilis baru: naikkan VERSI di bawah, jalankan `npm run build:desktop`
 * di purpspace-electron, upload hasilnya ke GitHub Release yang baru.
 * `DOWNLOAD_URL` akan otomatis mengarah ke versi yang benar.
 *
 * Nama berkasnya harus sama persis dengan `nsis.artifactName` di
 * `purpspace-electron/electron-builder.yml`.
 */

const REPO = "RadityaWirayudha/AiNgeSpace"

/** Samakan dengan `version` di purpspace-electron/package.json setiap rilis. */
const VERSI = "0.1.0"

export const DOWNLOAD_FILE = `PurpSpace-Setup-${VERSI}-x64.exe`
export const DOWNLOAD_URL = `https://github.com/${REPO}/releases/download/v${VERSI}/${DOWNLOAD_FILE}`

export const DOWNLOAD_META = {
  platform: "Windows 10/11",
  arch: "x64",
  version: `v${VERSI}`,
}

/**
 * Email kontak bisnis yang tampil di footer dan halaman Syarat & Ketentuan.
 * TODO: Ganti dengan email bisnis aktif kamu (bisa Gmail biasa).
 */
export const CONTACT_EMAIL = "purpspaceai@gmail.com"
