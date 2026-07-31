# Handoff — Responsivitas Multi-Terminal (AiNgeSpace Desktop)

> Berikan berkas ini ke agent penerus. Berkas ini adalah **prompt lengkap**: berisi
> tujuan, apa yang sudah jadi, keputusan desain yang sudah diambil (jangan
> diturunkan ulang), sisa pekerjaan yang konkret, dan jebakan yang sudah terbukti.
>
> Rencana penuh ada di `C:\Users\user\.claude\plans\indexed-bubbling-feather.md`.

---

## 0. Instruksi untuk agent penerus

Kamu melanjutkan pekerjaan yang sudah berjalan ~40%. Fondasinya (Tahap 1, 4, dan
sebagian 5) **sudah selesai dan terverifikasi bersih**. Sisanya adalah lapisan
React di atas fondasi itu.

Aturan main:

1. **Jangan bongkar arsitektur di §2.** Inversi kepemilikan terminal adalah inti
   perbaikan ini; kalau kamu mengembalikan `Terminal` ke dalam state React,
   seluruh manfaatnya hilang.
2. Baca `AGENTS.md` — versi Next.js di repo ini (16.2.11) punya breaking changes;
   baca `node_modules/next/dist/docs/` sebelum menulis kode yang menyentuh API
   Next. (Untuk sisa pekerjaan ini, satu-satunya sentuhan adalah `next/dynamic`
   yang **sudah** diverifikasi sesuai dokumen `01-app/02-guides/lazy-loading.md`
   — pola `dynamic(() => import(...).then(m => m.X), { ssr: false })` masih benar.)
3. Gaya kode: komentar dalam Bahasa Inggris (ikut kode sekitar), label UI dalam
   Bahasa Indonesia (ikut `CreateWorkspaceDialog.tsx`). Komentar menjelaskan
   **kenapa**, bukan apa.
4. Setelah tiap tahap: `npm run typecheck` dan `npx eslint src electron --max-warnings=0`.

---

## 1. Masalah yang sedang diselesaikan

User ingin grid multi-terminal seresponsif referensi (±10 terminal hidup
sekaligus, semuanya streaming output agent). Diagnosis: bukan masalah tuning,
tapi tiga hambatan arsitektural bertumpuk.

| # | Akar masalah | Status |
| --- | --- | --- |
| 1 | Tidak ada GPU renderer — xterm 6 jatuh ke DOM renderer | **selesai** |
| 2 | Setiap split men-dispose lalu membangun ulang xterm + replay 256 KB | **selesai** |
| 3 | Maximize diam-diam membunuh shell tetangga (bug kehilangan pekerjaan) | fondasi siap, butuh Tahap 2 |
| 4 | Badai resize: 1 `ResizeObserver`/terminal + IPC resize tiap frame | **selesai** |
| 5 | 1 pesan IPC per chunk PTY; chunk >512 KB dipotong diam-diam (korupsi) | **selesai** |
| 6 | Split terkunci 50/50, tidak bisa digeser | belum |
| 7 | `state.trees` tidak pernah dibebaskan (kebocoran) | belum |
| 8 | `convertEol` salah untuk PTY, `windowsPty` tidak diset, font race | **selesai** |
| 9 | Pintasan keyboard: tidak ada, harus bisa diganti + direset user | modul inti selesai, UI belum |

---

## 2. Arsitektur baru — WAJIB DIPAHAMI SEBELUM MENULIS KODE

**Sebelumnya:** objek `Terminal` hidup di dalam `useEffect` sebuah komponen.
`splitLeaf()` mengganti node leaf dengan node split baru → React meng-unmount
komponen → `term.dispose()` → shell mati / dibangun ulang dari replay buffer.

**Sekarang:** `Terminal` dimiliki oleh registry level modul di luar React tree.
React hanya memiliki **slot** (sebuah `<div>`). Split/maximize/pindah workspace
hanya memindahkan node DOM.

```
src/features/terminal/terminal-instances.ts   ← pemilik semua Terminal
        ▲                        ▲
        │ attach/detach          │ matchAction()
src/features/terminal/           src/features/terminal/
  TerminalPanel.tsx (slot)         keybindings.ts (keymap store)
```

Konsekuensi yang harus kamu jaga:

- `term.open()` dipanggil **sekali saja** saat instance dibuat. Pada xterm 6,
  `open()` kedua dengan parent berbeda adalah **no-op diam-diam** — pemindahan
  parent HARUS lewat `container.appendChild(inst.host)`.
- `detachInstance()` **tidak pernah** men-dispose. Satu-satunya jalur
  pembongkaran adalah `disposeInstance()` / `disposeInstancesExcept()`.
- `ResizeObserver` mengamati **container (slot React)**, bukan host. Host saat
  detached diparkir di staging node berukuran 800×600; kalau host yang diamati,
  setiap detach akan memicu resize PTY palsu ke 800×600.
- Terminal tersembunyi = `display:none` pada ancestor → `clientWidth === 0` →
  `fitInstance()` melewatinya → PTY mempertahankan ukuran terakhir → **shell
  tetap hidup**. Inilah mekanisme perbaikan bug maximize.

### API `terminal-instances.ts` (sudah jadi, pakai apa adanya)

```ts
ensureInstance(terminalId): void
attachInstance(terminalId, container: HTMLElement): void   // membuat jika belum ada
detachInstance(terminalId, container?: HTMLElement): void  // container = penjaga stale-cleanup
disposeInstance(terminalId): void
disposeInstancesExcept(keep: ReadonlySet<string>): void    // untuk GC
setFocusHandler(terminalId, handler: (() => void) | null): void
focusInstance(terminalId): void
requestFit(terminalId): void        // panggil ini setelah menulis ukuran ke DOM secara manual
requestFitAll(): void
visibleRects(): { id: string; rect: DOMRect }[]
neighbourInDirection(fromId, "left"|"right"|"up"|"down"): string | null
```

### API `keybindings.ts` (sudah jadi, pakai apa adanya)

```ts
ACTIONS: readonly ActionDef[]        // { id, label, description, group, defaultChord }
type ActionId = "terminal.splitRight" | "terminal.splitDown" | "terminal.duplicate"
              | "terminal.close" | "terminal.toggleMaximize" | "terminal.rename"
              | "terminal.focusLeft" | "terminal.focusRight"
              | "terminal.focusUp" | "terminal.focusDown"
              | "app.openShortcuts"

useKeymap(): Keymap                  // React, via useSyncExternalStore
getKeymap(): Keymap                  // runtime non-React
chordFor(id): string
matchAction(e: KeyboardEvent): ActionId | null
chordFromEvent(e): string | null     // null saat hanya modifier ditekan
formatChord("Alt+Shift+Equal") → "Alt+Shift+="
validateChord(chord, forAction): { ok: true } | { ok: false; reason: string }
setBinding(id, chord): ValidationResult
resetBinding(id): void
resetAll(): void
isDefault(id, keymap?): boolean
hasCustomBindings(keymap?): boolean
```

Bawaan: split kanan `Alt+Shift+=`, split bawah `Alt+Shift+-`, duplikat
`Ctrl+Shift+D`, maximize `Alt+Shift+Z`, tutup `Ctrl+Shift+W`, rename `F2`,
fokus `Alt+←/→/↑/↓`, dialog pintasan `Ctrl+Shift+/`.

---

## 3. Yang SUDAH selesai (jangan dikerjakan ulang)

Semua sudah lolos `npm run typecheck` (kedua tsconfig) dan `eslint --max-warnings=0`.

| Berkas | Status | Isi |
| --- | --- | --- |
| `package.json` | ✅ | `@xterm/addon-webgl@^0.19.0` terpasang (rilis seiring xterm 6.0.0 — lini 0.18 menyasar xterm 5.5, jangan turun versi) |
| `src/features/terminal/keybindings.ts` | ✅ **baru** | Store keymap level modul, chord dari `event.code`, persistensi override di `localStorage["bm.keybindings.v1"]`, validasi + denylist + deteksi bentrok, reset |
| `src/features/terminal/terminal-instances.ts` | ✅ **baru** | Registry instance, anggaran WebGL (12 konteks), `ResizeObserver` tunggal + fit scheduler rAF, dedup + debounce resize PTY (80 ms), banner + mock shell, `attachCustomKeyEventHandler`, fokus via `term.textarea`, refit saat `document.fonts.ready` |
| `src/features/terminal/TerminalPanel.tsx` | ✅ **ditulis ulang** | 357 baris → ~70 baris. Hanya slot: `attachInstance` saat mount, `detachInstance` saat cleanup, `memo` |
| `src/features/terminal/pty-session.ts` | ✅ | Grace window 2500 ms → 500 ms, komentar diperbarui (remount tidak lagi sampai ke modul ini) |
| `electron/pty-manager.ts` | ✅ | Output ter-batch per sesi (flush 8 ms), frame ≤256 KB dengan **pemecahan**, bukan pemotongan; flush sebelum event exit; bersih-bersih timer di `kill()` |
| `electron/main.ts` | ✅ | `process.env.BM_OS_BUILD` dari `os.release()` |
| `electron/preload.ts` | ✅ | `osBuild` di bridge |
| `src/types/desktop.d.ts` | ✅ | `readonly osBuild: number` |

---

## 4. SISA PEKERJAAN

### Tahap A — `src/features/terminal/pane-terminal-store.tsx`

1. **`sizes` pada split.** Tambah `sizes: number[]` ke interface `TerminalSplit`
   (pecahan, total 1). `splitLeaf()` membuat node baru dengan `sizes: [0.5, 0.5]`.
2. **`removeTerminal()` harus menjaga keselarasan `sizes`.** Implementasi
   sekarang `map(...).filter(non-null)` sehingga indeks `sizes` akan meleset.
   Tulis ulang agar melacak indeks anak yang dibuang, hapus entri `sizes`-nya,
   lalu normalisasi ulang sisanya supaya totalnya kembali 1.
3. **Aksi baru `RESIZE_SPLIT`** — payload `{ paneId, nodeId, sizes }`. Cari node
   split berdasarkan `nodeId` dan ganti `sizes`-nya.
4. **Aksi baru `DISPOSE_PANES`** — payload `{ paneIds: string[] }`. Hapus entri
   dari `trees`, `maximized`, `nameSeq`; kosongkan `activeTerminalId` bila
   pemiliknya ikut terhapus. Ini memperbaiki akar masalah #7.
5. **Effect GC di `PaneTerminalProvider`:**
   ```ts
   useEffect(() => {
     const alive = new Set<string>()
     for (const tree of Object.values(state.trees)) {
       for (const t of collectTerminals(tree)) alive.add(t.id)
     }
     disposeInstancesExcept(alive)
   }, [state.trees])
   ```
   Aman secara urutan: effect anak (slot yang membuat instance) berjalan
   **sebelum** effect parent, jadi instance yang baru dibuat sudah ada di tree
   saat GC berjalan. Tetap beri penjaga untuk render pertama saat `trees` kosong.
6. **Pecah context** menjadi `PaneTerminalStateContext` dan
   `PaneTerminalActionsContext`. Saat ini `usePaneTerminalStore()` mengembalikan
   `state` utuh, sehingga setiap perubahan `activeTerminalId` me-render ulang
   setiap leaf di setiap pane. Pertahankan `usePaneTerminalStore()` sebagai
   gabungan agar `BridgeMindLayout.tsx:121` tidak perlu diubah, tapi pakai hook
   terpisah di `TerminalLeafView`.
7. **Tambah `renamingTerminalId: string | null` ke state.** Dibutuhkan karena
   aksi `terminal.rename` dipicu dari listener keyboard global, sementara state
   `renaming` sekarang lokal di `TerminalLeafView`. Angkat ke store; jangan pakai
   custom DOM event.

### Tahap B — `src/features/terminal/PaneTerminalManager.tsx`

1. **Selalu render tree utuh.** Ganti `<TerminalNode node={maximizedLeaf ?? tree} …>`
   (baris ~378) menjadi `<TerminalNode node={tree} … maximizedId={maximizedId} />`.
   Teruskan `maximizedId` ke bawah. Di dalam `TerminalNode`, setiap anak yang
   `maximizedId && !findLeaf(child, maximizedId)` mendapat class `hidden`
   (Tailwind = `display:none`). `findLeaf` sudah ada dan diekspor.
   **Ini yang memperbaiki bug shell terbunuh** — jangan ganti dengan
   `visibility`, `opacity`, atau unmount.
2. **Ukuran anak** dari `node.sizes`: `style={{ flexGrow: node.sizes[i] ?? 1, flexBasis: 0 }}`.
   Buang `flex-1 basis-0` dari class.
3. **Komponen `<Sash>`** di antara anak (jangan dirender saat `maximizedId` aktif):
   - Area sentuh 5 px di atas garis 1 px, `cursor: col-resize` / `row-resize`.
   - `onPointerDown` → `setPointerCapture`, simpan rect parent + `flexGrow` kedua
     tetangga.
   - `onPointerMove` → hitung delta sebagai pecahan dari ukuran parent, clamp
     agar tiap sisi ≥ ~48 px, lalu **tulis `style.flexGrow` langsung ke dua node
     DOM tetangga** (jangan lewat state React), lalu panggil `requestFit(id)`
     untuk setiap terminal di dalam kedua subtree (pakai `collectTerminals`).
   - `onPointerUp` → satu dispatch `RESIZE_SPLIT` dengan array `sizes` final.
     Render ulang menghasilkan nilai identik sehingga tidak ada kedipan.
   - `onDoubleClick` → kembalikan ke rata.
   - Beri `data-split-index={i}` pada wrapper anak agar sash bisa menemukan
     tetangganya lewat `parentElement.querySelector`.
4. **Tooltip menampilkan chord.** `ToolbarBtn` (baris ~45) diberi prop opsional
   `chord?: string`; render `formatChord(chord)` di dalam `TooltipContent`.
   Ambil dari `useKeymap()`. Label aksi di `ACTIONS` sengaja dibuat sama persis
   dengan label tombol yang sudah ada ("Split right", "Close terminal", …)
   supaya tooltip dan dialog tidak pernah berbeda.
5. **Item menu "Pintasan keyboard…"** di `OverflowMenu` (baris ~85).
6. **Listener keyboard global.** Komponen baru (mis. `TerminalHotkeys`) yang
   dirender di dalam `PaneTerminalProvider`:
   - Satu `keydown` fase capture di `document`.
   - `const action = matchAction(e)`; kalau `null` → biarkan (shell yang ambil).
   - Kalau cocok → `e.preventDefault()` lalu jalankan aksinya terhadap
     `state.activeTerminalId`. Butuh lookup balik terminalId → paneId: iterasi
     `state.trees` dengan `findLeaf`.
   - Aksi fokus memakai `neighbourInDirection(activeId, arah)` lalu `setActive`.
   - Sisi xterm sudah beres: `attachCustomKeyEventHandler` di registry
     mengembalikan `false` untuk chord yang terikat, sehingga event lolos ke
     document alih-alih dikirim ke shell.

### Tahap C — `src/components/KeyboardShortcutsDialog.tsx` (baru)

Ikuti gaya `CreateWorkspaceDialog.tsx` (overlay + panel, label Bahasa Indonesia).

- Dikelompokkan per `action.group` ("Layout", "Navigasi", "Aplikasi").
- Tiap baris: label + deskripsi, chord (`formatChord`), tombol **Ubah** dan
  **Reset** (Reset hanya muncul bila `!isDefault(id)`), badge "diubah".
- Mode rekam: baris menangkap `keydown` berikutnya via `chordFromEvent`, `Esc`
  membatalkan, hasil `validateChord` yang gagal ditampilkan alasannya persis di
  baris itu (mis. "Bentrok dengan \"Close terminal\"",
  "Ctrl+C dipakai shell — tambahkan Shift atau Alt").
  **Penting:** saat merekam, panggil `e.preventDefault()` dan `e.stopPropagation()`
  supaya chord yang sedang direkam tidak ikut memicu aksinya sendiri.
- Footer: **"Reset semua ke bawaan"** (aktif hanya bila `hasCustomBindings()`,
  pakai satu langkah konfirmasi) + "Tutup".
- Buka dialog dari dua tempat: item `OverflowMenu` dan chord `app.openShortcuts`.
  Sarankan `ShortcutsDialogProvider` kecil dengan `useShortcutsDialog().open()`
  agar `OverflowMenu` yang letaknya dalam tidak perlu prop drilling.

### Tahap D — CSS + wiring layout

1. `src/app/globals.css`: kelas `.bm-sash` (garis `--bm-border`, hover/active
   `--bm-live`, transisi ~120 ms) mengikuti pola `.bm-sb-resize` yang sudah ada
   untuk sidebar. Tambahkan `contain: layout paint` pada `.bm-pane-body-flush`.
2. `src/features/workspace/BridgeMindLayout.tsx`:
   - `closePane` (baris ~177) → panggil `disposePanes([paneId])`.
   - `deleteWorkspace` (baris ~196) → `disposePanes(ws.panes.map(p => p.id))`.
   - Ini yang menyalakan GC; tanpanya shell terus hidup selamanya.

---

## 5. Jebakan yang sudah terbukti (jangan diulang)

1. **`term.open()` kedua adalah no-op.** Sudah diverifikasi langsung di
   `node_modules/@xterm/xterm/lib/xterm.js`. Pindahkan node, jangan open ulang.
2. **`WebglAddon` harus di-`loadAddon` SETELAH `term.open()`** — addon butuh
   elemen terminal sudah ada. Sudah benar di registry.
3. **Jangan amati host dengan `ResizeObserver`** — amati container. Lihat §2.
4. **Jangan baca `localStorage` di dalam `getSnapshot`.** Akan memicu
   ketidakcocokan hidrasi. Di `keybindings.ts` pemuatan terjadi di `subscribe`
   (berjalan setelah mount) dan `getServerSnapshot` mengembalikan bawaan.
5. **Chord memakai `event.code`, bukan `event.key`.** Shift mengubah `key`
   (`=` → `+`), sehingga `Alt+Shift+=` tidak akan pernah cocok dengan dirinya
   sendiri. `code` (`Equal`) stabil dan benar di layout non-QWERTY.
6. **Denylist chord bukan hiasan.** Tanpa itu user bisa mengikat `Ctrl+C` dan
   kehilangan interrupt di seluruh pane, tanpa jalan pulih selain menghapus
   localStorage secara manual.
7. **`convertEol` harus `false` untuk PTY sungguhan**, `true` hanya untuk mock
   shell. Sudah benar di registry — jangan disamakan.
8. **Banner memang hilang di mode desktop.** ConPTY memiliki seluruh screen
   buffer dan menimpanya. Ini disengaja dan sudah didokumentasikan di komentar
   `writeBanner()`; jangan "perbaiki" dengan mengoper `-Command <banner>` ke
   PowerShell — itu menambah risiko quoting di jalur yang tidak boleh rusak.
9. **`electron/channels.ts` adalah `const enum` yang disengaja.** Jangan
   nyalakan `isolatedModules` di `tsconfig.electron.json` — preload yang
   di-sandbox akan gagal me-`require` dan `window.bridgemind` jadi `undefined`
   tanpa error.

---

## 6. Verifikasi

```bash
npm run typecheck                                  # kedua tsconfig
npx eslint src electron --max-warnings=0
npm run dev:desktop
```

Uji manual di aplikasi:

1. **Regresi paling penting** — jalankan `ping -t 8.8.8.8` di pane A, lalu split,
   maximize pane B, restore, pindah workspace dan kembali. Ping pane A harus
   **masih berjalan** dengan scrollback utuh. Di build sebelum perubahan ini,
   shell-nya mati dan pekerjaan hilang.
2. Split sampai 8–12 terminal; cek ada `<canvas>` di bawah `.xterm-screen`
   (WebGL aktif), dan terminal di luar anggaran 12 konteks tetap tampil normal
   lewat DOM renderer.
3. Geser sash; output reflow langsung, ukuran bertahan setelah dilepas.
4. Resize window OS dengan 12 terminal; lalu lintas `bm:terminal:resize`
   seharusnya sekali per terminal per ukuran final, bukan per frame.
5. Latensi: jalankan `for($i=0;$i -lt 100000;$i++){echo $i}` di satu pane sambil
   mengetik di pane lain — echo ketikan harus tetap terasa instan.
6. Pintasan: `Ctrl+Shift+/` membuka dialog; ganti "Split right", pastikan chord
   baru bekerja **dan** tooltip tombol split ikut berubah tanpa reload; coba
   `Ctrl+C` (harus ditolak) dan chord yang sudah dipakai (harus lapor bentrok);
   "Reset semua ke bawaan" lalu muat ulang → `localStorage["bm.keybindings.v1"]`
   harus bersih.
7. Tutup pane dan hapus workspace → PTY terkait ikut mati, tidak ada
   `conhost.exe` yatim di Task Manager.
8. `npm run build:desktop` — build terpaket tetap start, addon WebGL terbundel.

---

## 7. Status git saat handoff

Branch `master`, belum ada commit untuk pekerjaan ini.

```
 M electron/main.ts
 M electron/preload.ts
 M electron/pty-manager.ts
 M package.json / package-lock.json
 M src/features/terminal/TerminalPanel.tsx
 M src/features/terminal/pty-session.ts
 M src/types/desktop.d.ts
?? src/features/terminal/keybindings.ts
?? src/features/terminal/terminal-instances.ts
```

Belum disentuh sama sekali: `pane-terminal-store.tsx`, `PaneTerminalManager.tsx`,
`BridgeMindLayout.tsx`, `globals.css`.

Di luar cakupan (jangan diubah): `TerminalManager.tsx`, `terminal-store.tsx`,
`TerminalToolbar.tsx` (jalur lama, hanya dipakai `WorkspaceView.tsx`), dan
seluruh alur auth/deep-link.
