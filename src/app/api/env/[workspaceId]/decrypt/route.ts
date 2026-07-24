import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/clerk/auth"
import { createServerClient } from "@/lib/supabase/server"
import { decrypt } from "@/lib/supabase/encryption"

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
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })

    if (error) throw error

    const decrypted = data.map((env) => ({
      id: env.id,
      key: env.key,
      value: decrypt(env.value),
      created_at: env.created_at,
      updated_at: env.updated_at,
    }))

    return NextResponse.json(decrypted)
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
