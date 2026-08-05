"use client"

/**
 * The terminal keymap, as data.
 *
 * This is a module-level store rather than React context on purpose: the xterm
 * key handler in `terminal-instances.ts` runs outside the React tree and has to
 * decide, synchronously, whether a keystroke belongs to the app or to the shell.
 * Routing that through context would mean re-attaching a handler to every live
 * terminal each time a binding changes.
 *
 * Chords are keyed off `event.code`, never `event.key`. Shift rewrites `key`
 * ("=" becomes "+"), so a binding recorded as `Alt+Shift+=` would never match
 * itself again; `code` ("Equal") is stable, and is also correct on non-QWERTY
 * layouts where the printed character moves but the physical key does not.
 */

import { useSyncExternalStore } from "react"

export type ActionId =
  | "terminal.splitRight"
  | "terminal.splitDown"
  | "terminal.duplicate"
  | "terminal.close"
  | "terminal.toggleMaximize"
  | "terminal.rename"
  | "terminal.focusLeft"
  | "terminal.focusRight"
  | "terminal.focusUp"
  | "terminal.focusDown"
  | "app.openShortcuts"

export interface ActionDef {
  id: ActionId
  /** Matches the wording already used on the pane toolbar, so the tooltip and
   *  the settings dialog can never drift apart. */
  label: string
  description: string
  group: string
  defaultChord: string
}

export const ACTIONS: readonly ActionDef[] = [
  {
    id: "terminal.splitRight",
    label: "Split right",
    description: "Membelah terminal aktif menjadi dua kolom",
    group: "Layout",
    defaultChord: "Alt+Shift+Equal",
  },
  {
    id: "terminal.splitDown",
    label: "Split down",
    description: "Membelah terminal aktif menjadi dua baris",
    group: "Layout",
    defaultChord: "Alt+Shift+Minus",
  },
  {
    id: "terminal.duplicate",
    label: "Duplicate",
    description: "Membuka terminal baru di sebelah yang aktif",
    group: "Layout",
    defaultChord: "Ctrl+Shift+KeyD",
  },
  {
    id: "terminal.toggleMaximize",
    label: "Maximize",
    description: "Membesarkan terminal aktif memenuhi pane, lalu mengembalikannya",
    group: "Layout",
    defaultChord: "Alt+Shift+KeyZ",
  },
  {
    id: "terminal.close",
    label: "Close terminal",
    description: "Menutup terminal aktif — pane selalu menyisakan satu",
    group: "Layout",
    defaultChord: "Ctrl+Shift+KeyW",
  },
  {
    id: "terminal.rename",
    label: "Rename",
    description: "Mengubah nama terminal aktif",
    group: "Layout",
    defaultChord: "F2",
  },
  {
    id: "terminal.focusLeft",
    label: "Focus left",
    description: "Pindah fokus ke terminal di sebelah kiri",
    group: "Navigasi",
    defaultChord: "Alt+ArrowLeft",
  },
  {
    id: "terminal.focusRight",
    label: "Focus right",
    description: "Pindah fokus ke terminal di sebelah kanan",
    group: "Navigasi",
    defaultChord: "Alt+ArrowRight",
  },
  {
    id: "terminal.focusUp",
    label: "Focus up",
    description: "Pindah fokus ke terminal di atas",
    group: "Navigasi",
    defaultChord: "Alt+ArrowUp",
  },
  {
    id: "terminal.focusDown",
    label: "Focus down",
    description: "Pindah fokus ke terminal di bawah",
    group: "Navigasi",
    defaultChord: "Alt+ArrowDown",
  },
  {
    id: "app.openShortcuts",
    label: "Keyboard shortcuts",
    description: "Membuka daftar pintasan ini",
    group: "Aplikasi",
    defaultChord: "Ctrl+Shift+Slash",
  },
]

export type Keymap = Readonly<Record<ActionId, string>>

const DEFAULTS = Object.freeze(
  Object.fromEntries(ACTIONS.map((a) => [a.id, a.defaultChord]))
) as Keymap

const ACTION_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]))

const STORAGE_KEY = "bm.keybindings.v1"

/* ------------------------------------------------------------------
   CHORD ENCODING
-------------------------------------------------------------------*/

/** Modifier order is fixed so that two encodings of the same chord compare equal. */
function encode(
  mods: { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean },
  code: string
): string {
  const parts: string[] = []
  if (mods.ctrl) parts.push("Ctrl")
  if (mods.alt) parts.push("Alt")
  if (mods.shift) parts.push("Shift")
  if (mods.meta) parts.push("Meta")
  parts.push(code)
  return parts.join("+")
}

const MODIFIER_CODES = new Set([
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "ShiftLeft",
  "ShiftRight",
  "MetaLeft",
  "MetaRight",
  "CapsLock",
])

/** `null` while only modifiers are held — a chord is not complete yet. */
export function chordFromEvent(e: KeyboardEvent): string | null {
  if (!e.code || MODIFIER_CODES.has(e.code)) return null
  return encode(
    { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey },
    e.code
  )
}

const CODE_LABELS: Record<string, string> = {
  Equal: "=",
  Minus: "-",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backquote: "`",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Escape: "Esc",
  Delete: "Del",
  Insert: "Ins",
  PageUp: "PgUp",
  PageDown: "PgDn",
  Space: "Space",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
}

function labelForCode(code: string): string {
  if (CODE_LABELS[code]) return CODE_LABELS[code]
  if (code.startsWith("Key")) return code.slice(3)
  if (code.startsWith("Digit")) return code.slice(5)
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`
  return code
}

/** `"Alt+Shift+Equal"` → `"Alt+Shift+="`. */
export function formatChord(chord: string): string {
  if (!chord) return "—"
  const parts = chord.split("+")
  const code = parts.pop() ?? ""
  return [...parts, labelForCode(code)].join("+")
}

/* ------------------------------------------------------------------
   STORE
-------------------------------------------------------------------*/

let overrides: Record<string, string> = {}
let current: Keymap = DEFAULTS
let loaded = false
const listeners = new Set<() => void>()

function recompute() {
  const next: Record<string, string> = { ...DEFAULTS }
  for (const action of ACTIONS) {
    const override = overrides[action.id]
    if (typeof override === "string" && override) next[action.id] = override
  }
  current = Object.freeze(next) as Keymap
}

function emit() {
  for (const listener of listeners) listener()
}

function persist() {
  try {
    if (Object.keys(overrides).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
    }
  } catch {
    // Private mode or a full quota: the keymap still works for this session.
  }
}

/**
 * Deliberately *not* called from `getSnapshot`. Reading localStorage during
 * render would make the first client render disagree with the server HTML;
 * loading from `subscribe` instead means hydration matches and the stored
 * bindings land one tick later.
 */
function ensureLoaded() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return
    // Only ids we still ship survive, so a binding for an action that was
    // removed in an update cannot resurrect itself or shadow a new one.
    for (const [id, chord] of Object.entries(parsed as Record<string, unknown>)) {
      if (ACTION_BY_ID.has(id as ActionId) && typeof chord === "string" && chord) {
        overrides[id] = chord
      }
    }
    recompute()
    emit()
  } catch {
    // Corrupt payload — fall back to defaults rather than refusing to start.
  }
}

/* ------------------------------------------------------------------
   VALIDATION
-------------------------------------------------------------------*/

/**
 * Control sequences the shell and readline own. Binding one of these would take
 * it away from every program running in every pane — Ctrl+C would stop
 * interrupting, Ctrl+D would stop sending EOF — and the only way back would be
 * to clear localStorage by hand. Note these are the *bare* forms: adding Shift
 * or Alt produces a chord no line editor listens for, which is exactly why the
 * defaults all carry a second modifier.
 */
const RESERVED = new Set([
  "Ctrl+KeyC",
  "Ctrl+KeyV",
  "Ctrl+KeyD",
  "Ctrl+KeyZ",
  "Ctrl+KeyL",
  "Ctrl+KeyA",
  "Ctrl+KeyE",
  "Ctrl+KeyU",
  "Ctrl+KeyK",
  "Ctrl+KeyW",
  "Ctrl+KeyR",
  "Ctrl+KeyP",
  "Ctrl+KeyN",
  "Ctrl+KeyB",
  "Ctrl+KeyF",
  "Ctrl+KeyG",
  "Ctrl+KeyY",
  "Ctrl+KeyT",
  "Ctrl+KeyO",
  "Ctrl+BracketLeft",
])

const FUNCTION_KEY = /^F([1-9]|1\d|2[0-4])$/

export type ValidationResult = { ok: true } | { ok: false; reason: string }

export function validateChord(chord: string, forAction: ActionId): ValidationResult {
  if (!chord) return { ok: false, reason: "Kombinasi kosong" }

  const parts = chord.split("+")
  const code = parts[parts.length - 1] ?? ""
  const hasCtrl = parts.includes("Ctrl")
  const hasAlt = parts.includes("Alt")
  const hasMeta = parts.includes("Meta")

  // Function keys are the one family a shell never claims, so they are usable
  // bare. Everything else needs a non-Shift modifier — Shift+letter is typing.
  if (!FUNCTION_KEY.test(code) && !hasCtrl && !hasAlt && !hasMeta) {
    return { ok: false, reason: "Butuh minimal Ctrl, Alt, atau Meta" }
  }

  if (RESERVED.has(chord)) {
    return {
      ok: false,
      reason: `${formatChord(chord)} dipakai shell — tambahkan Shift atau Alt`,
    }
  }

  const clash = (Object.keys(current) as ActionId[]).find(
    (id) => id !== forAction && current[id] === chord
  )
  if (clash) {
    return {
      ok: false,
      reason: `Bentrok dengan "${ACTION_BY_ID.get(clash)?.label ?? clash}"`,
    }
  }

  return { ok: true }
}

/* ------------------------------------------------------------------
   REACT BINDING
-------------------------------------------------------------------*/

function subscribe(listener: () => void): () => void {
  ensureLoaded()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): Keymap {
  return current
}

function getServerSnapshot(): Keymap {
  return DEFAULTS
}

/** Live keymap for React. Re-renders every consumer when a binding changes. */
export function useKeymap(): Keymap {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Runtime read for non-React callers (the xterm key handler). */
export function getKeymap(): Keymap {
  ensureLoaded()
  return current
}

export function chordFor(id: ActionId): string {
  return getKeymap()[id]
}

export function isDefault(id: ActionId, keymap: Keymap = current): boolean {
  return keymap[id] === DEFAULTS[id]
}

export function hasCustomBindings(keymap: Keymap = current): boolean {
  return ACTIONS.some((a) => keymap[a.id] !== a.defaultChord)
}

export function setBinding(id: ActionId, chord: string): ValidationResult {
  ensureLoaded()
  const result = validateChord(chord, id)
  if (!result.ok) return result

  if (chord === DEFAULTS[id]) delete overrides[id]
  else overrides[id] = chord

  recompute()
  persist()
  emit()
  return { ok: true }
}

export function resetBinding(id: ActionId) {
  ensureLoaded()
  if (!(id in overrides)) return
  delete overrides[id]
  recompute()
  persist()
  emit()
}

export function resetAll() {
  ensureLoaded()
  if (Object.keys(overrides).length === 0) return
  overrides = {}
  recompute()
  persist()
  emit()
}

/* ------------------------------------------------------------------
   MATCHING
-------------------------------------------------------------------*/

/** The action a keystroke triggers, or `null` when the shell should have it. */
export function matchAction(e: KeyboardEvent): ActionId | null {
  const chord = chordFromEvent(e)
  if (!chord) return null
  const keymap = getKeymap()
  for (const action of ACTIONS) {
    if (keymap[action.id] === chord) return action.id
  }
  return null
}

export { DEFAULTS as DEFAULT_KEYMAP }
