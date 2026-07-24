import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/clerk/auth"
import { createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  github_branch: z.string().optional(),
  local_path: z.string().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId()
    const { id } = await params
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from("aingespace_workspaces")
      .select("*")
      .eq("id", id)
      .eq("clerk_user_id", userId)
      .single()

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
      .from("aingespace_workspaces")
      .update(parsed)
      .eq("id", id)
      .eq("clerk_user_id", userId)
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

    const { error } = await supabase
      .from("aingespace_workspaces")
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
