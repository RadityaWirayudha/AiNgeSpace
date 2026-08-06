/**
 * Tautan unduhan aplikasi desktop.
 *
 * Berkasnya tidak ada di git — ukurannya ~180 MB dan sumbernya build
 * `purpspace-electron`, jadi `public/unduhan/` ter-gitignore. Yang mengisinya:
 *
 *   cd purpspace-electron && npm run build:desktop
 *   cd purpspace-webapp   && npm run unduhan:sync
 *
 * Nama berkasnya harus sama persis dengan `nsis.artifactName` di
 * `purpspace-electron/electron-builder.yml`. Dulu tidak sama — URL di sini
 * menyebut `PurpSpace-Setup-x64.exe` sementara buildnya menghasilkan
 * `PurpSpace-Setup-0.1.0-x64.exe` — dan tombolnya 404 tanpa ada yang tahu.
 * Sekarang `unduhan:sync` menolak jalan kalau `VERSI` di bawah tidak cocok
 * dengan versi app desktop.
 *
 * Satu konstanta, bukan dua: dulu versinya ditulis terpisah di URL dan di label,
 * dan itu persis cara keduanya bisa berselisih tanpa ketahuan.
 *
 * Saat website benar-benar di-deploy, arahkan `DOWNLOAD_URL` ke GitHub Releases
 * atau CDN — hosting website bukan tempat yang tepat untuk biner 180 MB.
 */

/** Samakan dengan `version` di purpspace-electron/package.json setiap rilis. */
const VERSI = "0.1.0"

export const DOWNLOAD_FILE = `PurpSpace-Setup-${VERSI}-x64.exe`
export const DOWNLOAD_URL = `/unduhan/${DOWNLOAD_FILE}`

export const DOWNLOAD_META = {
  platform: "Windows 10/11",
  arch: "x64",
  version: `v${VERSI}`,
}
