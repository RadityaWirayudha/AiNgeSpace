import Link from "next/link"

import { PurpSpaceMark } from "@/components/brand/PurpSpaceMark"
import { CONTACT_EMAIL } from "@/content/site"

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--bm-border)]">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 text-sm text-[var(--bm-text-dim)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <PurpSpaceMark className="size-5" />
            <span className="text-[var(--bm-text-secondary)]">PurpSpace</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:ml-auto">
            <Link href="/harga" className="transition-colors hover:text-[var(--bm-text)]">
              Harga
            </Link>
            <Link href="/#unduh" className="transition-colors hover:text-[var(--bm-text)]">
              Unduh
            </Link>
            <Link
              href="/syarat-ketentuan"
              className="transition-colors hover:text-[var(--bm-text)]"
            >
              Syarat &amp; Ketentuan
            </Link>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="transition-colors hover:text-[var(--bm-text)]"
            >
              Kontak
            </a>
            <span>© {new Date().getFullYear()} PurpSpace</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
