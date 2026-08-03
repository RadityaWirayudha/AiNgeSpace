import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/clerk/auth"
import { createServerClient } from "@/lib/supabase/server"
import { treeSchema, treeToJson } from "@/lib/panes/tree-schema"
import { z } from "zod"

const createPaneSchema = z.object({
  // The client mints the id so the row and the in-memory terminal tree, which
  // is keyed by pane id, share an identity before the response comes back.
  // Re-sending the same id after a failed request is an idempotent retry
  // rather than a duplicate pane.
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  position: z.number().int().min(0).max(64).optional(),
  pinned: z.boolean().optional(),
  tree: treeSchema,
  nameSeq: z.number().int().min(1).max(10_000).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId()
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get("workspaceId")

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 })
    }

    const supabase = createServerClient()

    // The old /api/terminals GET filtered by workspace_id and never checked who
    // owned it, so any signed-in user could read anyone else's terminal list by
    // guessing a workspace id. Ownership is verified first now.
    const { data: workspace } = await supabase
      .from("workspaces_purpspace")
      .select("id")
      .eq("id", workspaceId)
      .eq("clerk_user_id", userId)
      .maybeSingle()

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const { data, error } = await supabase
      .from("panes_purpspace")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: true })

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
    const parsed = createPaneSchema.parse(body)

    const supabase = createServerClient()

    const { data: workspace } = await supabase
      .from("workspaces_purpspace")
      .select("id")
      .eq("id", parsed.workspaceId)
      .eq("clerk_user_id", userId)
      .maybeSingle()

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    // insert, never upsert: the id arrives from the client, and an upsert would
    // let a caller overwrite somebody else's pane row by guessing its id and
    // naming a workspace they do own.
    const { data, error } = await supabase
      .from("panes_purpspace")
      .insert({
        ...(parsed.id ? { id: parsed.id } : {}),
        workspace_id: parsed.workspaceId,
        title: parsed.title,
        position: parsed.position ?? 0,
        pinned: parsed.pinned ?? false,
        tree: treeToJson(parsed.tree),
        name_seq: parsed.nameSeq ?? 1,
      })
      .select()
      .single()

    // 23505 is a primary key collision, which for a client-minted uuid means
    // the pane already exists — a retry of a request that in fact succeeded.
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Pane already exists" }, { status: 409 })
    }
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
