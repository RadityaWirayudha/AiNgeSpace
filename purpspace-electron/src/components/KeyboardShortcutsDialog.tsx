"use client"

/**
 * Shortcuts the user cannot see are shortcuts the user does not have, so the
 * keymap is exposed as an editable table rather than documented in a README.
 *
 * The provider lives here too: the entry points are a menu item buried inside
 * every terminal header and a global chord, and neither has a sensible path to
 * drill an `onOpen` prop down from the layout.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { X, RotateCcw, Keyboard, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ACTIONS,
  chordFromEvent,
  formatChord,
  hasCustomBindings,
  isDefault,
  resetAll,
  resetBinding,
  setBinding,
  useKeymap,
  type ActionDef,
  type ActionId,
} from "@/features/terminal/keybindings"

/* ------------------------------------------------------------------
   PROVIDER
-------------------------------------------------------------------*/

interface ShortcutsDialogValue {
  isOpen: boolean
  open: () => void
  close: () => void
}

const ShortcutsDialogContext = createContext<ShortcutsDialogValue | null>(null)

export function ShortcutsDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const value = useMemo<ShortcutsDialogValue>(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    [isOpen]
  )

  return (
    <ShortcutsDialogContext.Provider value={value}>
      {children}
      {/* Mounted only while open, so every visit starts with a clean row state
          instead of resuming whichever row was armed for recording last time. */}
      {isOpen && <KeyboardShortcutsDialog onClose={value.close} />}
    </ShortcutsDialogContext.Provider>
  )
}

export function useShortcutsDialog(): ShortcutsDialogValue {
  const ctx = useContext(ShortcutsDialogContext)
  if (!ctx) {
    throw new Error(
      "useShortcutsDialog must be used within ShortcutsDialogProvider"
    )
  }
  return ctx
}

/* ------------------------------------------------------------------
   ROW
-------------------------------------------------------------------*/

function ShortcutRow({
  action,
  chord,
  custom,
  recording,
  error,
  onRecord,
  onCancel,
  onReset,
}: {
  action: ActionDef
  chord: string
  custom: boolean
  recording: boolean
  error: string | null
  onRecord: () => void
  onCancel: () => void
  onReset: () => void
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors",
        recording
          ? "bg-purple/5 border-purple/40"
          : "bg-secondary border-border"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-foreground">
            {action.label}
          </span>
          {custom && (
            <span className="text-[10px] font-medium text-purple bg-purple/10 border border-purple/30 rounded px-1.5 py-px">
              diubah
            </span>
          )}
        </div>
        <p className="text-[11px] text-zinc-500 mt-0.5">{action.description}</p>
        {error && (
          <p className="flex items-center gap-1 text-[11px] text-destructive mt-1.5">
            <AlertCircle className="size-3 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <kbd
          aria-live={recording ? "polite" : undefined}
          className={cn(
            "inline-flex items-center justify-center min-w-[104px] h-7 px-2 rounded-md border text-[11px] font-mono",
            recording
              ? "border-purple text-purple animate-pulse"
              : "border-border bg-bm-bg text-foreground"
          )}
        >
          {recording ? "tekan kombinasi…" : formatChord(chord)}
        </kbd>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] text-zinc-400"
          onClick={recording ? onCancel : onRecord}
        >
          {recording ? "Batal" : "Ubah"}
        </Button>

        {/* Reset is a per-row affordance only where there is something to undo;
            showing a dead button on every row reads as broken. */}
        {custom && !recording && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Reset pintasan ${action.label}`}
            className="h-7 px-2 text-[11px] text-zinc-400"
            onClick={onReset}
          >
            <RotateCcw className="size-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------
   DIALOG
-------------------------------------------------------------------*/

function KeyboardShortcutsDialog({ onClose }: { onClose: () => void }) {
  const keymap = useKeymap()
  const [recording, setRecording] = useState<ActionId | null>(null)
  const [error, setError] = useState<{ id: ActionId; reason: string } | null>(
    null
  )
  const [confirmingReset, setConfirmingReset] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => {
    const out: { name: string; actions: ActionDef[] }[] = []
    for (const action of ACTIONS) {
      let group = out.find((g) => g.name === action.group)
      if (!group) {
        group = { name: action.group, actions: [] }
        out.push(group)
      }
      group.actions.push(action)
    }
    return out
  }, [])

  /**
   * Capture on `document` rather than on the row: the chord has to be caught
   * wherever focus happens to be, and it must be swallowed before anything else
   * sees it — otherwise recording `Ctrl+Shift+W` would close a terminal on the
   * way in. `TerminalHotkeys` stands down entirely while this dialog is open,
   * which is what keeps the two capture listeners from racing.
   */
  useEffect(() => {
    if (!recording) return
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === "Escape") {
        setRecording(null)
        setError(null)
        return
      }

      const chord = chordFromEvent(e)
      // Only modifiers so far — keep waiting for the key that completes it.
      if (!chord) return

      const result = setBinding(recording, chord)
      if (!result.ok) {
        setError({ id: recording, reason: result.reason })
        return
      }
      setRecording(null)
      setError(null)
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [recording])

  // Kept out of the Escape effect below so that arming a row for recording does
  // not briefly hand scrolling back to the page underneath.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  // Escape closes, but only when it is not already spoken for by recording.
  useEffect(() => {
    if (recording) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [recording, onClose])

  // Keep Tab inside the panel; without it focus walks into the terminal grid
  // behind the overlay and keystrokes start reaching a shell.
  useEffect(() => {
    const node = dialogRef.current
    if (!node) return

    node.querySelector<HTMLElement>("button:not([disabled])")?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null)
      if (focusables.length === 0) return
      const firstEl = focusables[0]
      const lastEl = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    node.addEventListener("keydown", onKeyDown)
    return () => node.removeEventListener("keydown", onKeyDown)
  }, [])

  const customised = hasCustomBindings(keymap)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-bm-fade-in"
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bm-shortcuts-title"
        className="relative w-full max-w-[640px] max-h-[90vh] flex flex-col bg-bm-pane border border-bm-border rounded-xl shadow-2xl overflow-hidden animate-bm-dialog-in"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup dialog"
          className="absolute top-3 right-3 z-10 size-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <X className="size-4" />
        </button>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-7 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <span className="size-8 rounded-lg bg-purple/10 border border-purple/30 flex items-center justify-center shrink-0">
              <Keyboard className="size-4 text-purple" strokeWidth={1.9} />
            </span>
            <div>
              <h2
                id="bm-shortcuts-title"
                className="text-lg font-bold tracking-tight text-foreground"
              >
                Pintasan keyboard
              </h2>
              <p className="text-[12px] text-zinc-500">
                Klik <span className="text-zinc-400">Ubah</span>, lalu tekan
                kombinasi baru. Esc membatalkan.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-5">
            {groups.map((group) => (
              <section key={group.name}>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                  {group.name}
                </h3>
                <div className="space-y-1.5">
                  {group.actions.map((action) => (
                    <ShortcutRow
                      key={action.id}
                      action={action}
                      chord={keymap[action.id]}
                      custom={!isDefault(action.id, keymap)}
                      recording={recording === action.id}
                      error={error?.id === action.id ? error.reason : null}
                      onRecord={() => {
                        setRecording(action.id)
                        setError(null)
                      }}
                      onCancel={() => {
                        setRecording(null)
                        setError(null)
                      }}
                      onReset={() => {
                        resetBinding(action.id)
                        setError(null)
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-7 py-4 border-t border-bm-border bg-bm-bg/40 shrink-0">
          {/* Two clicks, because this throws away every customisation at once
              and there is no undo once localStorage has been cleared. */}
          <Button
            variant="ghost"
            size="sm"
            disabled={!customised}
            onClick={() => {
              if (!confirmingReset) {
                setConfirmingReset(true)
                return
              }
              resetAll()
              setConfirmingReset(false)
              setError(null)
            }}
            className={cn(
              "gap-1.5 text-[12px]",
              confirmingReset ? "text-destructive" : "text-zinc-400"
            )}
          >
            <RotateCcw className="size-3.5" />
            {confirmingReset
              ? "Klik lagi untuk mengonfirmasi"
              : "Reset semua ke bawaan"}
          </Button>

          <Button size="sm" onClick={onClose} className="font-semibold">
            Tutup
          </Button>
        </div>
      </div>
    </div>
  )
}
