import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/clerk/auth"
import { createServerClient } from "@/lib/supabase/server"
import { DEFAULT_LAYOUT_PRESET, LAYOUT_PRESET_IDS } from "@/lib/workspace/layouts"
import { z } from "zod"

const createWorkspaceSchema = z.object({
  // Optional: the create dialog stopped asking for a name, so the server names
  // the workspace from what the caller already owns. Still accepted, because a
  // rename endpoint and any future importer need to set it explicitly.
  name: z.string().trim().min(1).max(255).optional(),
  // No path-shape validation on purpose: what counts as a valid path differs
  // per OS, and the only check that actually matters — does this folder exist
  // on the machine running the shell — belongs to the Electron main process
  // (isDirectory() in pty-manager.ts).
  workingDir: z.string().trim().min(1).max(4096),
  // The dialog has always collected these two; until now the POST body dropped
  // them, so the layout survived only in localStorage and the agent selection
  // was discarded outright.
  layoutPreset: z.enum(LAYOUT_PRESET_IDS).default(DEFAULT_LAYOUT_PRESET),
  agentIds: z.array(z.string().min(1).max(64)).max(32).default([]),
})

export async function GET() {
  try {
    const userId = await getAuthUserId()
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from("workspaces_purpspace")
      .select("*")
      .eq("clerk_user_id", userId)
      // Matches workspaces_purpspace_owner_idx, and honours the order the user
      // set by dragging rows in the sidebar.
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const AUTO_NAME_RE = /^Workspace (\d+)$/

/**
 * "Workspace 1", "Workspace 2", … Counts from the highest number already in use
 * rather than filling the first gap: reusing the number of a deleted workspace
 * would give two different things the same label in the user's memory.
 *
 * Names are not unique in the schema, so two requests racing here can both land
 * on the same number. That is a cosmetic collision the user can rename away —
 * worth far less than the round trip a lock would cost.
 */
function nextWorkspaceName(existing: string[]): string {
  const highest = existing.reduce((max, name) => {
    const match = AUTO_NAME_RE.exec(name)
    if (!match) return max
    const n = Number(match[1])
    return Number.isSafeInteger(n) && n > max ? n : max
  }, 0)
  return `Workspace ${highest + 1}`
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId()
    const body = await request.json()
    const parsed = createWorkspaceSchema.parse(body)

    const supabase = createServerClient()

    // One read serves both the auto-name and the sort_order. New workspaces land
    // at the end of the user's list; read-then-write is safe enough, because a
    // collision only means two rows share a sort_order and the created_at
    // tiebreaker keeps the order stable either way.
    const { data: existing, error: existingError } = await supabase
      .from("workspaces_purpspace")
      .select("name, sort_order")
      .eq("clerk_user_id", userId)

    if (existingError) throw existingError

    const owned = existing ?? []
    const lastOrder = owned.reduce((max, row) => Math.max(max, row.sort_order), -1)

    const { data, error } = await supabase
      .from("workspaces_purpspace")
      .insert({
        clerk_user_id: userId,
        name: parsed.name ?? nextWorkspaceName(owned.map((row) => row.name)),
        working_dir: parsed.workingDir,
        layout_preset: parsed.layoutPreset,
        agent_ids: parsed.agentIds,
        sort_order: lastOrder + 1,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 })
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(200),
})

/** Persists the sidebar's drag-to-reorder, which until now was lost on reload. */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getAuthUserId()
    const body = await request.json()
    const { orderedIds } = reorderSchema.parse(body)

    const supabase = createServerClient()

    // Every update is scoped to the caller, so an id belonging to someone else
    // matches no row rather than reordering their sidebar.
    const results = await Promise.all(
      orderedIds.map((id, index) =>
        supabase
          .from("workspaces_purpspace")
          .update({ sort_order: index })
          .eq("id", id)
          .eq("clerk_user_id", userId)
      )
    )

    const failed = results.find((r) => r.error)
    if (failed?.error) throw failed.error

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 })
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
