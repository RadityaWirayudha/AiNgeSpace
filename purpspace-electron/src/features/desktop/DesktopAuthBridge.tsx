"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth, useSignIn } from "@clerk/nextjs"
import type { DesktopBridge } from "@/types/desktop"

/**
 * The app half of desktop sign-in.
 *
 * Flow: this component opens `/desktop-auth` in the user's real browser → the
 * browser signs in through Clerk's hosted pages and mints a sign-in ticket →
 * the ticket comes back over `purpspace://auth?ticket=…` → here it is traded
 * for a session inside the Electron window's own cookie jar.
 *
 * Rendered from `ClerkProvider` rather than from the layout on purpose: that
 * provider only mounts Clerk's context after its own `useEffect`, and a child
 * of the layout would call `useSignIn()` one render too early and throw.
 *
 * Renders nothing outside Electron and nothing once signed in, so the browser
 * build and the normal signed-in window are visually untouched.
 */

type Status = "idle" | "waiting" | "exchanging" | "error"

const DEEP_LINK_SCHEME = "purpspace:"
const DEEP_LINK_ACTION = "auth"

export function DesktopAuthBridge() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth()
  // `useSignIn` returns Clerk's signal shape in this version: `signIn` is null
  // until Clerk has loaded, and the flow runs through `ticket()`/`finalize()`
  // rather than the older `create({ strategy })` + `setActive` pair.
  const { signIn } = useSignIn()

  // Read once, at first render. Safe without an effect because `ClerkProvider`
  // only renders this component after its own mount, so there is no server
  // render and no hydration pass to disagree with — and `window.purpspace` is
  // injected by the preload before any script runs, so it never changes later.
  const [desktop] = useState<DesktopBridge | null>(() =>
    typeof window === "undefined" ? null : (window.purpspace ?? null)
  )
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  // A ticket can arrive before Clerk finishes loading — the deep link is
  // replayed the moment the subscription exists. Park it rather than drop it.
  const [pendingTicket, setPendingTicket] = useState<string | null>(null)
  // Tickets whose exchange has already been started. A sign-in ticket is
  // single-use, so this must not be derived from state: the effect below runs
  // twice per mount under StrictMode in dev, and the second run would spend a
  // ticket the first run had already consumed.
  const startedRef = useRef<Set<string>>(new Set())
  // Mirrors `isSignedIn` for the async exchange below, which would otherwise
  // read whatever value was captured when it started.
  const isSignedInRef = useRef(false)

  useEffect(() => {
    isSignedInRef.current = Boolean(isSignedIn)
  }, [isSignedIn])

  useEffect(() => {
    if (!desktop) return
    return desktop.onDeepLink((raw) => {
      let url: URL
      try {
        url = new URL(raw)
      } catch {
        // Logged rather than swallowed: a deep link that arrives and is then
        // discarded in silence looks exactly like one that never arrived, and
        // the two have completely different causes.
        console.warn("[desktop-auth] unparseable deep link:", raw)
        return
      }
      // Ignore any other deep link the app may grow later.
      if (url.protocol !== DEEP_LINK_SCHEME || url.host !== DEEP_LINK_ACTION) return
      const ticket = url.searchParams.get("ticket")
      if (ticket) {
        setStatus("exchanging")
        setError(null)
        setPendingTicket(ticket)
      } else {
        console.warn("[desktop-auth] deep link carried no ticket:", url.pathname)
      }
    })
  }, [desktop])

  useEffect(() => {
    if (!pendingTicket || !signIn) return
    const ticket = pendingTicket
    if (startedRef.current.has(ticket)) return
    startedRef.current.add(ticket)

    // The pill can only show one short line; the console keeps the full reason,
    // and with ELECTRON_ENABLE_LOGGING set by `dev:desktop` it reaches the
    // terminal instead of dying inside the renderer.
    const fail = (stage: string, reason: string) => {
      console.error(`[desktop-auth] ${stage} failed:`, reason)
      setStatus("error")
      setError(reason)
      setPendingTicket(null)
    }

    // Deliberately no cleanup that aborts this: `ticket()` followed by
    // `finalize()` is one indivisible, non-idempotent trade. Bailing out
    // between the two — which a `cancelled` flag did on every StrictMode
    // remount — burns the ticket without ever activating the session, and the
    // window would sit signed-out holding a ticket that can no longer be used.
    void (async () => {
      const attempt = await signIn.ticket({ ticket })
      if (attempt.error) {
        // Reaching this with a live session means the trade already went
        // through (a replayed deep link, or a session opened meanwhile), so the
        // user is signed in and there is nothing to report.
        if (isSignedInRef.current) {
          setStatus("idle")
          setPendingTicket(null)
          return
        }
        fail("ticket exchange", attempt.error.message)
        return
      }
      // A ticket cannot satisfy a second factor, so anything short of
      // `complete` is a dead end rather than a step to continue from here.
      if (signIn.status !== "complete") {
        fail("ticket exchange", `Sign-in stopped at "${signIn.status}".`)
        return
      }
      const finalized = await signIn.finalize()
      if (finalized.error) {
        fail("finalize", finalized.error.message)
        return
      }
      setStatus("idle")
      setPendingTicket(null)
    })()
  }, [pendingTicket, signIn])

  const startSignIn = useCallback(() => {
    if (!desktop) return
    setStatus("waiting")
    setError(null)
    // Same origin as the running window, so the browser reaches this app's own
    // local server and Clerk sees the session it is about to mint a ticket for.
    void desktop.openExternal(`${window.location.origin}/desktop-auth`)
  }, [desktop])

  if (!desktop || !authLoaded || isSignedIn) return null

  const busy = status === "exchanging"
  const label =
    status === "exchanging"
      ? "Signing in…"
      : status === "waiting"
        ? "Waiting for browser…"
        : "Sign in"

  return (
    <div className="fixed bottom-3 right-3 z-50 flex flex-col items-end gap-1.5">
      {error && (
        <p className="max-w-[16rem] rounded-sm border border-bm-live/40 bg-bm-pane px-2 py-1 text-right text-[10px] leading-snug text-bm-live">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={startSignIn}
        disabled={busy}
        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-sm border border-bm-border bg-bm-pane-header text-[11px] text-bm-text hover:border-bm-live/40 disabled:opacity-60 disabled:hover:border-bm-border transition-colors"
      >
        <span className="text-bm-text-dim">»</span>
        {label}
      </button>
    </div>
  )
}
