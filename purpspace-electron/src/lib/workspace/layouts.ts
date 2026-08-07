/**
 * The terminal layout presets, in one place.
 *
 * These ids are written to `purpspace_workspaces.layout_preset`, and that
 * column carries a CHECK constraint listing exactly these six values — so this
 * file and `supabase/migrations/002_rewrite_aingespace_schema.sql` (the table
 * was named `workspaces_aingespace` when it was created; `003_rename_to_
 * purpspace.sql` renamed it) have to move together.
 *
 * The list used to exist three times over: in the create dialog, and as a bare
 * string enum in both workspace route handlers. Only the dialog knew how many
 * terminals a preset actually meant, which is why the count had to be smuggled
 * to the workspace route through localStorage.
 *
 * Kept free of imports so route handlers, client components and the Electron
 * side can all read it.
 */

export const LAYOUT_PRESETS = [
  { id: "l1", label: "1", count: 1 },
  { id: "l2v", label: "2", count: 2, dir: "row" },
  { id: "l2h", label: "2", count: 2, dir: "col" },
  { id: "l4", label: "4", count: 4, grid: [2, 2] },
  { id: "l6", label: "6", count: 6, grid: [3, 2] },
  { id: "l8", label: "8", count: 8, grid: [4, 2] },
] as const

export type LayoutPreset = (typeof LAYOUT_PRESETS)[number]
export type LayoutPresetId = LayoutPreset["id"]

export const DEFAULT_LAYOUT_PRESET: LayoutPresetId = "l1"

/**
 * `z.enum()` wants a non-empty tuple, which `.map()` cannot produce on its own.
 * The cast is confined here so the ids still have exactly one definition.
 */
export const LAYOUT_PRESET_IDS = LAYOUT_PRESETS.map((preset) => preset.id) as
  unknown as readonly [LayoutPresetId, ...LayoutPresetId[]]

export function isLayoutPresetId(value: string): value is LayoutPresetId {
  return LAYOUT_PRESETS.some((preset) => preset.id === value)
}

/** How many panes a workspace opens with. Unknown ids fall back to a single
 *  terminal rather than an empty grid. */
export function terminalCountFor(presetId: string): number {
  return LAYOUT_PRESETS.find((preset) => preset.id === presetId)?.count ?? 1
}
