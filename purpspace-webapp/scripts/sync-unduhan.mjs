/**
 * Menyalin installer desktop hasil `npm run build:desktop` ke `public/unduhan/`,
 * supaya tombol unduh di website benar-benar memberi berkas.
 *
 * KENAPA SCRIPT, BUKAN SALIN MANUAL
 *
 * Sebelum ini `DOWNLOAD_URL` menunjuk `/unduhan/PurpSpace-Setup-x64.exe`,
 * sementara electron-builder menamai keluarannya
 * `PurpSpace-Setup-<versi>-x64.exe`. Dua string itu tidak pernah dibandingkan
 * oleh siapa pun, jadi tombolnya 404 sampai ada orang yang mengkliknya. Script
 * ini menutup celah itu di langkah 3: setelah menyalin, ia memastikan
 * `src/content/site.ts` memang menyebut nama berkas yang barusan disalin, dan
 * berhenti dengan error kalau tidak.
 *
 * Versinya dibaca dari `purpspace-electron/package.json` — bukan ditulis ulang
 * di sini — supaya naik versi cukup di satu tempat.
 *
 * CATATAN DEPLOY: `public/unduhan/` ter-gitignore (berkasnya ~180 MB). Jadi
 * hasil script ini hanya ada di mesin yang menjalankannya. Waktu website
 * benar-benar di-deploy, arahkan `DOWNLOAD_URL` ke GitHub Releases atau CDN dan
 * folder ini tidak diperlukan lagi.
 */
import { copyFile, mkdir, readFile, stat } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const desktop = resolve(root, "..", "purpspace-electron")

async function baca(path) {
  try {
    return await readFile(path, "utf8")
  } catch {
    return null
  }
}

// 1. Versi datang dari app desktop, satu-satunya pihak yang berhak menentukannya.
const manifest = await baca(join(desktop, "package.json"))
if (!manifest) {
  console.error(`[unduhan] tidak menemukan ${join(desktop, "package.json")}`)
  console.error("[unduhan] script ini mengharapkan purpspace-electron/ ada di sebelah purpspace-webapp/")
  process.exit(1)
}
const { version } = JSON.parse(manifest)

// 2. Nama berkasnya mengikuti `nsis.artifactName` di purpspace-electron/electron-builder.yml.
//    Kalau pola di sana diubah, ubah juga di sini — tidak ada cara membacanya tanpa
//    menambah dependency parser YAML untuk satu baris.
const berkas = `PurpSpace-Setup-${version}-x64.exe`
const sumber = join(desktop, "dist", berkas)

let ukuran
try {
  ukuran = (await stat(sumber)).size
} catch {
  console.error(`[unduhan] installer belum ada di ${sumber}`)
  console.error("[unduhan] jalankan dulu:  cd purpspace-electron && npm run build:desktop")
  process.exit(1)
}

// Installer utuh ratusan MB. Yang berukuran ratusan KB itu build electron-builder
// yang terputus sebelum 7z-nya ditanam — kelihatan seperti installer, tapi gagal
// waktu dijalankan. Lebih baik ketahuan di sini daripada di mesin pengunduh.
const MINIMAL = 50 * 1024 * 1024
if (ukuran < MINIMAL) {
  console.error(
    `[unduhan] ${berkas} cuma ${(ukuran / 1024 / 1024).toFixed(1)} MB — itu build yang terputus, bukan installer utuh.`
  )
  console.error("[unduhan] ulangi `npm run build:desktop` sampai selesai, lalu jalankan lagi.")
  process.exit(1)
}

// 3. Salin.
const tujuan = join(root, "public", "unduhan", berkas)
await mkdir(dirname(tujuan), { recursive: true })
await copyFile(sumber, tujuan)

// 4. Penjaga: website harus benar-benar menunjuk berkas yang barusan disalin.
//    site.ts merangkai URL-nya dari satu konstanta `VERSI`, jadi yang perlu
//    dicocokkan cuma konstanta itu — dibaca dengan regex, bukan di-import,
//    karena file .ts tidak bisa dijalankan Node apa adanya.
const sitePath = join(root, "src", "content", "site.ts")
const site = await baca(sitePath)
if (site === null) {
  console.error(`[unduhan] tidak bisa membaca ${sitePath}`)
  process.exit(1)
}

const cocok = site.match(/const VERSI = "([^"]+)"/)
if (!cocok) {
  console.error('[unduhan] tidak menemukan `const VERSI = "…"` di src/content/site.ts.')
  console.error("[unduhan] penjaga versi ini ikut hilang kalau konstantanya diganti bentuk — perbarui script-nya juga.")
  process.exit(1)
}
if (cocok[1] !== version) {
  console.error(`[unduhan] ${berkas} sudah disalin, TAPI site.ts masih menunjuk versi ${cocok[1]}.`)
  console.error(`[unduhan] tombol unduhnya akan 404. Ubah VERSI di src/content/site.ts jadi "${version}".`)
  process.exit(1)
}

console.log(`[unduhan] ${berkas} (${(ukuran / 1024 / 1024).toFixed(1)} MB) -> public/unduhan/`)
console.log(`[unduhan] tersaji di /unduhan/${berkas}`)
