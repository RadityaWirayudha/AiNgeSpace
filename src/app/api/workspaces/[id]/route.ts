import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/clerk/auth"
import { createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const LAYOUT_PRESETS = ["l1", "l2v", "l2h", "l4", "l6", "l8"] as const

const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    github_branch: z.string().trim().min(1).max(255).optional(),
    local_path: z.string().nullable().optional(),
    layout_preset: z.enum(LAYOUT_PRESETS).optional(),
    agent_ids: z.array(z.string().min(1).max(64)).max(32).optional(),
  })
  // An empty body used to produce an UPDATE with no columns, which PostgREST
  // rejects with a 500 rather than saying what was wrong.
  .refine((v) => Object.keys(v).length > 0, {
    message: "Tidak ada field yang diubah",
  })

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId()
    const { id } = await params
    const supabase = createServerClient()

    // maybeSingle, not single: a workspace that does not exist (or belongs to
    // somebody else) is a 404, and `single()` turned that into a thrown error
    // that the catch below reported as a 500.
    const { data, error } = await supabase
      .from("workspaces_aingespace")
      .select("*")
      .eq("id", id)
      .eq("clerk_user_id", userId)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId()
    const { id } = await params
    const body = await request.json()
    const parsed = updateWorkspaceSchema.parse(body)

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from("workspaces_aingespace")
      .update(parsed)
      .eq("id", id)
      .eq("clerk_user_id", userId)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

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

    // Panes and env vars go with the workspace via ON DELETE CASCADE.
    const { error } = await supabase
      .from("workspaces_aingespace")
      .delete()
      .eq("id", id)
      .eq("clerk_user_id", userId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
