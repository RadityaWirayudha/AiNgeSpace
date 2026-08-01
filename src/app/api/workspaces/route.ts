import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/clerk/auth"
import { createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const LAYOUT_PRESETS = ["l1", "l2v", "l2h", "l4", "l6", "l8"] as const

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(255),
  githubRepo: z
    .string()
    .trim()
    .regex(/^[\w.-]+\/[\w.-]+$/, "Gunakan format pengguna/nama-repo"),
  githubBranch: z.string().trim().min(1).max(255).default("main"),
  localPath: z.string().optional(),
  // The dialog has always collected these two; until now the POST body dropped
  // them, so the layout survived only in localStorage and the agent selection
  // was discarded outright.
  layoutPreset: z.enum(LAYOUT_PRESETS).default("l1"),
  agentIds: z.array(z.string().min(1).max(64)).max(32).default([]),
})

export async function GET() {
  try {
    const userId = await getAuthUserId()
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from("workspaces_aingespace")
      .select("*")
      .eq("clerk_user_id", userId)
      // Matches workspaces_aingespace_owner_idx, and honours the order the user
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

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId()
    const body = await request.json()
    const parsed = createWorkspaceSchema.parse(body)

    const supabase = createServerClient()

    // New workspaces land at the end of the user's list. Read-then-write is
    // safe enough here: a collision only means two rows share a sort_order, and
    // the created_at tiebreaker keeps the order stable either way.
    const { data: last } = await supabase
      .from("workspaces_aingespace")
      .select("sort_order")
      .eq("clerk_user_id", userId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await supabase
      .from("workspaces_aingespace")
      .insert({
        clerk_user_id: userId,
        name: parsed.name,
        github_repo: parsed.githubRepo,
        github_branch: parsed.githubBranch,
        local_path: parsed.localPath ?? null,
        layout_preset: parsed.layoutPreset,
        agent_ids: parsed.agentIds,
        sort_order: (last?.sort_order ?? -1) + 1,
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
          .from("workspaces_aingespace")
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
