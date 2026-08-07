import { NextRequest, NextResponse } from "next/server"
import { createAuthedClient } from "@/lib/supabase/server"
import { LAYOUT_PRESET_IDS } from "@/lib/workspace/layouts"
import { isUuid } from "@/lib/uuid"
import { z } from "zod"

const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    working_dir: z.string().trim().min(1).max(4096).optional(),
    layout_preset: z.enum(LAYOUT_PRESET_IDS).optional(),
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
    const { supabase, userId } = await createAuthedClient()
    const { id } = await params
    // A local-only workspace id ("local-3") never reaches the database as a
    // uuid comparison — PostgreSQL rejects the literal and the catch below
    // would report a 500 for what is plainly a 404.
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    // maybeSingle, not single: a workspace that does not exist (or belongs to
    // somebody else) is a 404, and `single()` turned that into a thrown error
    // that the catch below reported as a 500.
    const { data, error } = await supabase
      .from("purpspace_workspaces")
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
    const { supabase, userId } = await createAuthedClient()
    const { id } = await params
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }
    const body = await request.json()
    const parsed = updateWorkspaceSchema.parse(body)

    const { data, error } = await supabase
      .from("purpspace_workspaces")
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
    const { supabase, userId } = await createAuthedClient()
    const { id } = await params
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    // Panes and env vars go with the workspace via ON DELETE CASCADE.
    const { error } = await supabase
      .from("purpspace_workspaces")
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
