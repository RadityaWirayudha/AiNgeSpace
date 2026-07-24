import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/clerk/auth"
import { createServerClient } from "@/lib/supabase/server"
import { encrypt, decrypt } from "@/lib/supabase/encryption"
import { z } from "zod"

const createEnvSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.string().min(1),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const userId = await getAuthUserId()
    const { workspaceId } = await params
    const supabase = createServerClient()

    const { data: workspace } = await supabase
      .from("aingespace_workspaces")
      .select("id")
      .eq("id", workspaceId)
      .eq("clerk_user_id", userId)
      .single()

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const { data, error } = await supabase
      .from("aingespace_environment_variables")
      .select("id, key, created_at, updated_at")
      .eq("workspace_id", workspaceId)
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const userId = await getAuthUserId()
    const { workspaceId } = await params
    const body = await request.json()
    const parsed = createEnvSchema.parse(body)

    const supabase = createServerClient()

    const { data: workspace } = await supabase
      .from("aingespace_workspaces")
      .select("id")
      .eq("id", workspaceId)
      .eq("clerk_user_id", userId)
      .single()

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const encryptedValue = encrypt(parsed.value)

    const { data, error } = await supabase
      .from("aingespace_environment_variables")
      .insert({
        workspace_id: workspaceId,
        key: parsed.key,
        value: encryptedValue,
      })
      .select("id, key, created_at, updated_at")
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Environment variable already exists" }, { status: 409 })
      }
      throw error
    }

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const userId = await getAuthUserId()
    const { workspaceId } = await params
    const { searchParams } = new URL(request.url)
    const envId = searchParams.get("id")

    if (!envId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: workspace } = await supabase
      .from("aingespace_workspaces")
      .select("id")
      .eq("id", workspaceId)
      .eq("clerk_user_id", userId)
      .single()

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const { error } = await supabase
      .from("aingespace_environment_variables")
      .delete()
      .eq("id", envId)
      .eq("workspace_id", workspaceId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
