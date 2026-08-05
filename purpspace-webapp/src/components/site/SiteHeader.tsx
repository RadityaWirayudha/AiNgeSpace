/**
 * Nav atas. Referensi (image #1) punya Products / Agents / How it works /
 * Pricing / Blog / Sign In; di sini tinggal Fitur + Harga, karena route yang
 * lain belum ada isinya dan halaman sign-in memang di luar cakupan pass ini.
 *
 * "Fitur" sengaja anchor ke `/#fitur` (bukan `#fitur`) supaya tetap bekerja
 * saat header ini dirender di `/harga`.
 */
import Link from "next/link"

import { PurpSpaceMark } from "@/components/brand/PurpSpaceMark"
import { ButtonLink } from "@/components/ui/button"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--bm-border)] bg-[#0e0e10]/80 backdrop-blur-md">
      <nav className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <PurpSpaceMark className="size-6" title="PurpSpace" />
          <span className="text-[15px] font-semibold tracking-tight">
            PurpSpace
          </span>
        </Link>

        <div className="hidden items-center gap-6 text-sm text-[var(--bm-text-secondary)] sm:flex">
          <Link href="/#fitur" className="transition-colors hover:text-[var(--bm-text)]">
            Fitur
          </Link>
          <Link href="/harga" className="transition-colors hover:text-[var(--bm-text)]">
            Harga
          </Link>
          <Link href="/#unduh" className="transition-colors hover:text-[var(--bm-text)]">
            Unduh
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ButtonLink href="/mulai" size="sm">
            Mulai Free Trial
          </ButtonLink>
        </div>
      </nav>
    </header>
  )
}
