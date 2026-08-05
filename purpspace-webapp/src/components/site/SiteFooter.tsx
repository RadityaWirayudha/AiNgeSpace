import Link from "next/link"

import { PurpSpaceMark } from "@/components/brand/PurpSpaceMark"

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--bm-border)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-[var(--bm-text-dim)] sm:flex-row sm:items-center">
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
          <span>© {new Date().getFullYear()} PurpSpace</span>
        </div>
      </div>
    </footer>
  )
}
