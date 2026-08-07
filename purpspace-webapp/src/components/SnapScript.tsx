/**
 * SnapScript — memuat Snap.js dari Midtrans sekali di level layout.
 *
 * Taruh komponen ini di layout halaman yang menampilkan tombol bayar
 * (mis. layout halaman akun / upgrade), bukan di root layout — Snap.js
 * tidak dibutuhkan di landing page maupun halaman pendaftaran.
 *
 * Cara pakai di layout:
 * ```tsx
 * import { SnapScript } from "@/components/SnapScript"
 * // ...
 * <SnapScript />
 * ```
 *
 * Setelah dimuat, tombol bayar bisa memanggil:
 * ```ts
 * // @ts-expect-error — snap ada di window setelah script dimuat
 * window.snap.pay(snapToken, { onSuccess, onPending, onError, onClose })
 * ```
 */
import Script from "next/script"

export function SnapScript() {
  // URL berbeda antara Sandbox dan Production.
  // Pakai MIDTRANS_IS_PRODUCTION, BUKAN NODE_ENV — Cloudflare Workers selalu
  // NODE_ENV="production" sehingga pakai NODE_ENV akan memuat snap.js Production
  // bahkan ketika key-nya masih Sandbox, lalu transaksi gagal diam-diam.
  const snapUrl =
    process.env.MIDTRANS_IS_PRODUCTION === "true"
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js"

  return (
    <Script
      src={snapUrl}
      data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
      strategy="lazyOnload"
    />
  )
}
