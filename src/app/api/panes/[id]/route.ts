import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/clerk/auth"
import { createServerClient } from "@/lib/supabase/server"
import { treeSchema, treeToJson } from "@/lib/panes/tree-schema"
import type { Database } from "@/types/database"
import { z } from "zod"

type PaneUpdate = Database["public"]["Tables"]["panes_aingespace"]["Update"]

const updatePaneSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    position: z.number().int().min(0).max(64).optional(),
    pinned: z.boolean().optional(),
    tree: treeSchema.optional(),
    nameSeq: z.number().int().min(1).max(10_000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Tidak ada field yang diubah",
  })

/**
 * A pane is only reachable through its workspace, so both handlers below join
 * back to the owner in a single query rather than the two round trips the old
 * /api/terminals/[id] used.
 */
async function ownedPane(
  supabase: ReturnType<typeof createServerClient>,
  paneId: string,
  userId: string
) {
  const { data } = await supabase
    .from("panes_aingespace")
    .select("id, workspaces_aingespace!inner(clerk_user_id)")
    .eq("id", paneId)
    .eq("workspaces_aingespace.clerk_user_id", userId)
    .maybeSingle()

  return data
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId()
    const { id } = await params
    const body = await request.json()
    const parsed = updatePaneSchema.parse(body)

    const supabase = createServerClient()

    if (!(await ownedPane(supabase, id, userId))) {
      return NextResponse.json({ error: "Pane not found" }, { status: 404 })
    }

    // nameSeq is camelCase on the wire and snake_case in the table, so the
    // parsed object cannot be handed to update() as-is.
    const patch: PaneUpdate = {}
    if (parsed.title !== undefined) patch.title = parsed.title
    if (parsed.position !== undefined) patch.position = parsed.position
    if (parsed.pinned !== undefined) patch.pinned = parsed.pinned
    if (parsed.tree !== undefined) patch.tree = treeToJson(parsed.tree)
    if (parsed.nameSeq !== undefined) patch.name_seq = parsed.nameSeq

    const { data, error } = await supabase
      .from("panes_aingespace")
      .update(patch)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId()
    const { id } = await params
    const supabase = createServerClient()

    if (!(await ownedPane(supabase, id, userId))) {
      return NextResponse.json({ error: "Pane not found" }, { status: 404 })
    }

    const { error } = await supabase.from("panes_aingespace").delete().eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
