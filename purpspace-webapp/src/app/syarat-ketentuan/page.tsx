/**
 * Halaman Syarat & Ketentuan + Kebijakan Pengembalian Dana.
 *
 * Diperlukan untuk verifikasi merchant Midtrans — kriteria website:
 *  - Ada syarat & ketentuan penggunaan layanan
 *  - Ada kebijakan pengembalian dana
 *  - Ada informasi kontak bisnis
 */
import type { Metadata } from "next"

import { SiteFooter } from "@/components/site/SiteFooter"
import { SiteHeader } from "@/components/site/SiteHeader"
import { PLANS } from "@/content/plans"
import { CONTACT_EMAIL, WEBSITE_URL } from "@/content/site"

export const metadata: Metadata = {
  title: "Syarat & Ketentuan — PurpSpace",
  description:
    "Syarat dan ketentuan penggunaan layanan PurpSpace, termasuk kebijakan pembayaran dan pengembalian dana.",
}

/** Perbarui tanggal ini setiap kali isi halaman diubah. */
const LAST_UPDATED = "8 Agustus 2026"

export default function SyaratKetentuanPage() {
  const [basic, pro] = PLANS

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:py-20">

          {/* ─── Judul ─── */}
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Syarat &amp; Ketentuan
          </h1>
          <p className="mt-3 text-sm text-[var(--bm-text-dim)]">
            Terakhir diperbarui: {LAST_UPDATED}
          </p>
          <p className="mt-6 text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
            Dengan mengakses atau menggunakan layanan PurpSpace, kamu menyetujui
            syarat dan ketentuan berikut. Harap baca dengan seksama sebelum
            menggunakan layanan kami.
          </p>

          <hr className="my-10 border-[var(--bm-border)]" />

          {/* ─── 1. Layanan ─── */}
          <section className="mb-10">
            <h2 className="mb-3 text-xl font-semibold">1. Layanan PurpSpace</h2>
            <p className="text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
              PurpSpace adalah aplikasi desktop manajemen terminal untuk developer,
              yang berjalan di Windows 10 dan 11. Layanan mencakup aplikasi desktop,
              akses akun berbasis web, dan fitur berlangganan. Semua fitur hanya
              dapat digunakan setelah mengunduh dan memasang aplikasi di komputer
              pengguna.
            </p>
          </section>

          {/* ─── 2. Pendaftaran ─── */}
          <section className="mb-10">
            <h2 className="mb-3 text-xl font-semibold">2. Pendaftaran Akun</h2>
            <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
              <li>Pendaftaran terbuka untuk pengguna berusia 17 tahun ke atas.</li>
              <li>Data yang dimasukkan saat mendaftar harus valid dan akurat.</li>
              <li>Satu akun diperuntukkan bagi satu pengguna individual.</li>
              <li>
                Kamu bertanggung jawab penuh atas keamanan kata sandi dan seluruh
                aktivitas yang terjadi di bawah akunmu.
              </li>
            </ul>
          </section>

          {/* ─── 3. Berlangganan ─── */}
          <section className="mb-10">
            <h2 className="mb-3 text-xl font-semibold">
              3. Berlangganan &amp; Pembayaran
            </h2>
            <p className="mb-4 text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
              PurpSpace menawarkan dua paket berlangganan bulanan:
            </p>
            <ul className="mb-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
              <li>
                <strong className="text-[var(--bm-text)]">Paket {basic.name}</strong>
                {" "}— {basic.price}
                {basic.period}. Free trial {basic.badge?.replace("Gratis ", "").toLowerCase()} tersedia, batal kapan saja.
              </li>
              <li>
                <strong className="text-[var(--bm-text)]">Paket {pro.name}</strong>
                {" "}— {pro.price}
                {pro.period}. Fitur lengkap termasuk Grid Terminal tanpa batas.
              </li>
            </ul>
            <p className="text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
              Semua transaksi menggunakan mata uang{" "}
              <strong className="text-[var(--bm-text)]">Rupiah (IDR)</strong> melalui
              platform pembayaran Midtrans. Metode yang diterima meliputi Virtual
              Account (Mandiri, BNI, BRI, Permata, BCA, dan lainnya), GoPay, dan
              QRIS. Berlangganan diperpanjang otomatis setiap bulan dan dapat
              dibatalkan kapan saja sebelum periode berikutnya dimulai.
            </p>
          </section>

          {/* ─── 4. Kebijakan Pengembalian Dana ─── */}
          <section className="mb-10">
            <h2 className="mb-3 text-xl font-semibold">
              4. Kebijakan Pengembalian Dana
            </h2>
            <p className="mb-4 text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
              PurpSpace adalah produk perangkat lunak digital. Harap gunakan masa
              free trial sebelum berlangganan berbayar.
            </p>
            <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
              <li>
                <strong className="text-[var(--bm-text)]">Free trial 12 hari</strong>{" "}
                tersedia di Paket Basic — tidak diperlukan pembayaran di muka.
                Gunakan masa ini untuk memastikan layanan sesuai kebutuhanmu.
              </li>
              <li>
                Pengembalian dana{" "}
                <strong className="text-[var(--bm-text)]">tidak tersedia</strong> untuk
                periode berlangganan yang telah berjalan, kecuali dalam kondisi berikut.
              </li>
              <li>
                Pengembalian dana{" "}
                <strong className="text-[var(--bm-text)]">dapat diproses secara proporsional</strong>{" "}
                apabila terjadi gangguan teknis dari pihak PurpSpace yang menyebabkan
                layanan tidak dapat diakses sama sekali selama lebih dari 7 (tujuh)
                hari kalender berturut-turut.
              </li>
              <li>
                Untuk mengajukan pengembalian dana, kirim email ke{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-[var(--color-purple-light)] hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>{" "}
                dengan menyertakan bukti transaksi (nomor order Midtrans).
              </li>
            </ul>
          </section>

          {/* ─── 5. Larangan ─── */}
          <section className="mb-10">
            <h2 className="mb-3 text-xl font-semibold">5. Larangan Penggunaan</h2>
            <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
              <li>Berbagi akun dengan pengguna lain (satu akun untuk satu orang).</li>
              <li>Melakukan rekayasa balik (<em>reverse engineering</em>) terhadap aplikasi.</li>
              <li>Mendistribusikan ulang aplikasi tanpa izin tertulis dari PurpSpace.</li>
              <li>Menggunakan layanan untuk aktivitas yang melanggar hukum Republik Indonesia.</li>
            </ul>
          </section>

          {/* ─── 6. Kekayaan Intelektual ─── */}
          <section className="mb-10">
            <h2 className="mb-3 text-xl font-semibold">6. Kekayaan Intelektual</h2>
            <p className="text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
              Seluruh konten, kode sumber, desain, dan merek dagang PurpSpace
              adalah milik pengembang PurpSpace dan dilindungi oleh hukum kekayaan
              intelektual yang berlaku di Republik Indonesia.
            </p>
          </section>

          {/* ─── 7. Penghentian ─── */}
          <section className="mb-10">
            <h2 className="mb-3 text-xl font-semibold">7. Penghentian Layanan</h2>
            <p className="text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
              PurpSpace berhak menangguhkan atau menghentikan akses akun yang
              terbukti melanggar syarat ini. Kamu dapat menghentikan berlangganan
              kapan saja melalui halaman akunmu — akses tetap aktif hingga akhir
              periode yang sudah dibayar.
            </p>
          </section>

          {/* ─── 8. Perubahan Syarat ─── */}
          <section className="mb-10">
            <h2 className="mb-3 text-xl font-semibold">
              8. Perubahan Syarat &amp; Ketentuan
            </h2>
            <p className="text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
              PurpSpace dapat memperbarui syarat ini sewaktu-waktu. Pengguna aktif
              akan diberitahu melalui email terdaftar minimal 14 hari sebelum
              perubahan berlaku.
            </p>
          </section>

          {/* ─── 9. Hukum ─── */}
          <section className="mb-10">
            <h2 className="mb-3 text-xl font-semibold">9. Hukum yang Berlaku</h2>
            <p className="text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
              Syarat dan ketentuan ini tunduk pada hukum Republik Indonesia. Setiap
              sengketa diselesaikan melalui musyawarah, dan apabila tidak tercapai
              kesepakatan, melalui jalur hukum yang berlaku di Indonesia.
            </p>
          </section>

          <hr className="my-10 border-[var(--bm-border)]" />

          {/* ─── 10. Kontak ─── */}
          <section>
            <h2 className="mb-3 text-xl font-semibold">10. Hubungi Kami</h2>
            <p className="text-[15px] leading-relaxed text-[var(--bm-text-secondary)]">
              Pertanyaan, keluhan, atau permohonan terkait syarat &amp; ketentuan
              ini dapat dikirimkan ke:
            </p>
            <p className="mt-3 text-[15px] text-[var(--bm-text-secondary)]">
              <strong className="text-[var(--bm-text)]">Email:</strong>{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-[var(--color-purple-light)] hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
            <p className="mt-3 text-[15px] text-[var(--bm-text-secondary)]">
              <strong className="text-[var(--bm-text)]">Website:</strong>{" "}
              <a
                href={WEBSITE_URL}
                className="text-[var(--color-purple-light)] hover:underline"
              >
                {WEBSITE_URL.replace("https://", "")}
              </a>
            </p>
          </section>

        </div>
      </main>

      <SiteFooter />
    </>
  )
}
