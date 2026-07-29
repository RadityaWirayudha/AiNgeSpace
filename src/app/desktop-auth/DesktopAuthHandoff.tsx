"use client"

import { useEffect, useMemo } from "react"

/**
 * Renders in the user's browser, not in the app. Its only job is to hand the
 * sign-in ticket to the desktop app through the custom protocol and then get
 * out of the way.
 */
export function DesktopAuthHandoff({ ticket }: { ticket: string }) {
  const target = useMemo(
    () => `aingespace://auth?ticket=${encodeURIComponent(ticket)}`,
    [ticket]
  )
  useEffect(() => {
    // Assigning `location.href` is what actually invokes the protocol handler.
    // The browser stays on this page — it does not navigate — so the fallback
    // link below remains available if the OS association is missing.
    window.location.href = target
  }, [target])

  return (
    <main className="min-h-screen flex items-center justify-center bg-bm-bg px-6">
      <div className="max-w-sm w-full rounded-md border border-bm-border bg-bm-pane p-6 text-center">
        <p className="text-[13px] font-medium text-bm-text">
          Returning you to BridgeMind
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-bm-text-secondary">
          The desktop app should be signed in now. You can close this tab.
        </p>
        <a
          href={target}
          className="mt-4 inline-flex items-center justify-center h-7 px-3 rounded-sm border border-bm-border bg-bm-pane-header text-[11px] text-bm-text hover:border-bm-live/40 transition-colors"
        >
          Open BridgeMind
        </a>
      </div>
    </main>
  )
}
