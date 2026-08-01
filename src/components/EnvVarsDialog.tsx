"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  ApiError,
  deleteEnvVar,
  fetchEnvValues,
  fetchEnvVars,
  saveEnvVar,
  type EnvVarRow,
} from "@/features/workspace/workspace-api"

/** Mirrors env_vars_aingespace_key_format and the route's own zod check, so a
 *  bad key is refused before it costs a round trip. */
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]{0,254}$/

const MASK = "••••••••••••"

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Sesi berakhir. Masuk lagi."
    if (error.status === 404) return "Workspace ini tidak ditemukan di server."
    return error.message
  }
  return "Gagal menghubungi server."
}

/* ------------------------------------------------------------------
   ROW
-------------------------------------------------------------------*/

function EnvRow({
  row,
  value,
  failed,
  revealed,
  busy,
  onEdit,
  onDelete,
}: {
  row: EnvVarRow
  value: string | undefined
  /** The server could read the row but not decrypt it — almost always a value
   *  written under a previous ENCRYPTION_KEY. */
  failed: boolean
  revealed: boolean
  busy: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (value === undefined) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // Clipboard denied (no permission, or an insecure origin). The value is
      // on screen either way.
    }
  }

  return (
    <div className="group flex items-center gap-2 h-9 px-2 rounded-md border border-bm-border bg-bm-pane-header">
      <KeyRound className="size-3 shrink-0 text-bm-text-dim" />
      <span className="shrink-0 max-w-[38%] truncate font-mono text-[11px] text-bm-text">
        {row.key}
      </span>
      <span className="shrink-0 text-bm-text-dim">=</span>

      {failed ? (
        <span className="flex items-center gap-1 min-w-0 text-[11px] text-bm-warning">
          <AlertTriangle className="size-3 shrink-0" />
          <span className="truncate">
            tidak bisa didekripsi — tulis ulang nilainya
          </span>
        </span>
      ) : (
        <span
          className={cn(
            "flex-1 min-w-0 truncate font-mono text-[11px]",
            revealed && value !== undefined
              ? "text-bm-text-secondary"
              : "text-bm-text-dim"
          )}
        >
          {revealed && value !== undefined ? value || "(kosong)" : MASK}
        </span>
      )}

      {confirming ? (
        <span className="ml-auto flex items-center gap-1 shrink-0">
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={() => {
              setConfirming(false)
              onDelete()
            }}
            className="bm-btn bm-btn-danger"
          >
            Hapus
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="bm-btn"
          >
            Batal
          </button>
        </span>
      ) : (
        <span className="ml-auto flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {!failed && (
            <button
              type="button"
              aria-label={`Salin nilai ${row.key}`}
              disabled={value === undefined || busy}
              onClick={copy}
              className="bm-ib bm-ib-sm disabled:opacity-30"
            >
              {copied ? (
                <Check className="size-3 relative" />
              ) : (
                <Copy className="size-3 relative" />
              )}
            </button>
          )}
          <button
            type="button"
            aria-label={`Ubah ${row.key}`}
            disabled={busy}
            onClick={onEdit}
            className="bm-ib bm-ib-sm disabled:opacity-30"
          >
            <Pencil className="size-3 relative" />
          </button>
          <button
            type="button"
            aria-label={`Hapus ${row.key}`}
            disabled={busy}
            onClick={() => setConfirming(true)}
            className="bm-ib bm-ib-sm bm-ib-danger disabled:opacity-30"
          >
            <Trash2 className="size-3 relative" />
          </button>
        </span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------
   DIALOG
-------------------------------------------------------------------*/

export function EnvVarsDialog({
  open,
  workspaceId,
  workspaceName,
  onClose,
}: {
  open: boolean
  /** Null while no workspace is selected; the dialog renders nothing. */
  workspaceId: string | null
  workspaceName: string
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  const [rows, setRows] = useState<EnvVarRow[] | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState<Set<string>>(new Set())
  const [revealed, setRevealed] = useState(false)
  // Starts true, and nothing resets it: the caller keys this component by
  // workspace id, so switching workspaces mounts a fresh dialog rather than
  // clearing a dozen fields from inside an effect.
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [draftKey, setDraftKey] = useState("")
  const [draftValue, setDraftValue] = useState("")
  /** Set when the form was opened from a row, so the heading can say so. */
  const [editingKey, setEditingKey] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setDraftKey("")
    setDraftValue("")
    setEditingKey(null)
    setFormError(null)
  }, [])

  /* -- loading ------------------------------------------------------ */

  useEffect(() => {
    if (!open || !workspaceId) return
    let cancelled = false

    // Plaintext is never fetched on open: the listing endpoint deliberately
    // withholds it, and /decrypt runs only when the user asks.
    fetchEnvVars(workspaceId)
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((e) => {
        if (!cancelled) setError(messageFor(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, workspaceId])

  /** Fetches plaintext once and returns it, so both "reveal" and "edit a row"
   *  share a single round trip. */
  const loadValues = useCallback(async (): Promise<Record<string, string>> => {
    if (!workspaceId) return {}
    const list = await fetchEnvValues(workspaceId)
    const next: Record<string, string> = {}
    const bad = new Set<string>()
    for (const item of list) {
      if (item.value === null) bad.add(item.id)
      else next[item.id] = item.value
    }
    setRows(list.map(({ id, key, created_at, updated_at }) => ({
      id,
      key,
      created_at,
      updated_at,
    })))
    setValues(next)
    setFailed(bad)
    return next
  }, [workspaceId])

  const toggleReveal = useCallback(async () => {
    if (revealed) {
      // Dropping the plaintext, not just hiding it: nothing keeps decrypted
      // secrets in memory longer than they are on screen.
      setValues({})
      setRevealed(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await loadValues()
      setRevealed(true)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }, [revealed, loadValues])

  /* -- mutations ---------------------------------------------------- */

  const startEdit = useCallback(
    async (row: EnvVarRow) => {
      setEditingKey(row.key)
      setDraftKey(row.key)
      setFormError(null)
      // A key that failed to decrypt has no value to prefill — the point of
      // editing it is to write a readable one.
      if (failed.has(row.id)) {
        setDraftValue("")
        return
      }
      if (values[row.id] !== undefined) {
        setDraftValue(values[row.id])
        return
      }
      setBusy(true)
      try {
        const loaded = await loadValues()
        setDraftValue(loaded[row.id] ?? "")
        setRevealed(true)
      } catch (e) {
        setError(messageFor(e))
      } finally {
        setBusy(false)
      }
    },
    [failed, values, loadValues]
  )

  const submit = useCallback(async () => {
    if (!workspaceId) return
    const key = draftKey.trim()
    if (!KEY_RE.test(key)) {
      setFormError(
        "Kunci harus diawali huruf atau garis bawah, lalu huruf, angka, atau garis bawah."
      )
      return
    }
    if (draftValue.length === 0) {
      setFormError("Nilai tidak boleh kosong.")
      return
    }

    setBusy(true)
    setFormError(null)
    setError(null)
    try {
      const saved = await saveEnvVar(workspaceId, key, draftValue)
      setRows((prev) => {
        const list = prev ?? []
        const without = list.filter((r) => r.id !== saved.id && r.key !== key)
        return [...without, saved].sort((a, b) => a.key.localeCompare(b.key))
      })
      // Keeping the new value in the revealed map avoids a second /decrypt
      // just to show what the user typed a moment ago.
      if (revealed) setValues((prev) => ({ ...prev, [saved.id]: draftValue }))
      setFailed((prev) => {
        if (!prev.has(saved.id)) return prev
        const next = new Set(prev)
        next.delete(saved.id)
        return next
      })
      resetForm()
    } catch (e) {
      setFormError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }, [workspaceId, draftKey, draftValue, revealed, resetForm])

  const remove = useCallback(
    async (row: EnvVarRow) => {
      if (!workspaceId) return
      setBusy(true)
      setError(null)
      try {
        await deleteEnvVar(workspaceId, row.id)
        setRows((prev) => (prev ?? []).filter((r) => r.id !== row.id))
        setValues((prev) => {
          const next = { ...prev }
          delete next[row.id]
          return next
        })
        if (editingKey === row.key) resetForm()
      } catch (e) {
        setError(messageFor(e))
      } finally {
        setBusy(false)
      }
    },
    [workspaceId, editingKey, resetForm]
  )

  /* -- chrome ------------------------------------------------------- */

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose])

  // Tab stays inside the dialog; without this it walks into the sidebar behind
  // the overlay.
  useEffect(() => {
    if (!open) return
    const node = dialogRef.current
    if (!node) return

    node.querySelector<HTMLInputElement>("input")?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null)
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    node.addEventListener("keydown", onKeyDown)
    return () => node.removeEventListener("keydown", onKeyDown)
  }, [open])

  if (!open || !workspaceId) return null

  const list = rows ?? []

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
        aria-labelledby="env-dialog-title"
        className="relative w-full max-w-[560px] max-h-[85vh] flex flex-col bg-bm-pane border border-bm-border rounded-xl shadow-2xl overflow-hidden animate-bm-dialog-in"
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-bm-border">
          <div className="min-w-0 flex-1">
            <h2
              id="env-dialog-title"
              className="text-[13px] font-semibold text-bm-text"
            >
              Environment variables
            </h2>
            <p className="mt-0.5 text-[11px] text-bm-text-secondary truncate">
              {workspaceName} · nilainya disimpan terenkripsi dan hanya dikirim
              ke browser saat kamu memintanya.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="shrink-0 size-7 rounded-md flex items-center justify-center text-bm-text-dim hover:text-bm-text hover:bg-white/5 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-5 h-8 shrink-0 border-b border-bm-border bg-bm-pane-header">
            <AlertTriangle className="size-3 shrink-0 text-bm-warning" />
            <span className="text-[11px] text-bm-text-secondary truncate">
              {error}
            </span>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-5 py-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-bm-text-dim">
              {list.length} variabel
            </span>
            {list.length > 0 && (
              <button
                type="button"
                onClick={toggleReveal}
                disabled={busy}
                className="inline-flex items-center gap-1.5 h-6 px-2 rounded-sm border border-bm-border text-[10px] text-bm-text-secondary hover:text-bm-text disabled:opacity-40 transition-colors"
              >
                {busy && !revealed ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : revealed ? (
                  <EyeOff className="size-3" />
                ) : (
                  <Eye className="size-3" />
                )}
                {revealed ? "Sembunyikan nilai" : "Tampilkan nilai"}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10">
              <Loader2 className="size-3.5 animate-spin text-bm-text-dim" />
              <span className="text-[11px] text-bm-text-dim">Memuat…</span>
            </div>
          ) : list.length === 0 ? (
            <p className="py-8 text-center text-[11px] text-bm-text-dim">
              Belum ada variabel. Yang kamu tambahkan di sini tersedia untuk
              terminal workspace ini.
            </p>
          ) : (
            <div className="grid gap-1">
              {list.map((row) => (
                <EnvRow
                  key={row.id}
                  row={row}
                  value={values[row.id]}
                  failed={failed.has(row.id)}
                  revealed={revealed}
                  busy={busy}
                  onEdit={() => void startEdit(row)}
                  onDelete={() => void remove(row)}
                />
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="shrink-0 border-t border-bm-border px-5 py-4"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-bm-text-dim">
              {editingKey ? `Ubah ${editingKey}` : "Tambah variabel"}
            </span>
            {editingKey && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[10px] text-bm-text-dim hover:text-bm-text transition-colors"
              >
                Batal
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder="API_KEY"
              aria-label="Nama variabel"
              spellCheck={false}
              autoComplete="off"
              className="w-[38%] min-w-0 h-8 px-2 rounded-md bg-bm-bg border border-bm-border font-mono text-[11px] text-bm-text placeholder:text-bm-text-dim outline-none focus:border-bm-link/50 transition-colors"
            />
            <input
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              placeholder="nilai"
              aria-label="Nilai variabel"
              // Not type="password": these are project secrets the user is
              // deliberately entering, and a masked field makes typos invisible
              // in a value nothing else will ever echo back.
              spellCheck={false}
              autoComplete="off"
              className="flex-1 min-w-0 h-8 px-2 rounded-md bg-bm-bg border border-bm-border font-mono text-[11px] text-bm-text placeholder:text-bm-text-dim outline-none focus:border-bm-link/50 transition-colors"
            />
            <button
              type="submit"
              disabled={busy}
              className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-bm-border bg-bm-pane-header text-[11px] text-bm-text hover:border-bm-live/40 disabled:opacity-40 transition-colors"
            >
              {busy ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Plus className="size-3" />
              )}
              Simpan
            </button>
          </div>

          <p
            className={cn(
              "mt-2 text-[10px] leading-tight",
              formError ? "text-destructive" : "text-bm-text-dim"
            )}
          >
            {formError ??
              "Menyimpan kunci yang sudah ada akan menimpa nilainya."}
          </p>
        </form>
      </div>
    </div>
  )
}
