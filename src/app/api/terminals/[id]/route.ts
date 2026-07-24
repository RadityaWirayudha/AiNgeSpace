import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/clerk/auth"
import { createServerClient } from "@/lib/supabase/server"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId()
    const { id } = await params
    const supabase = createServerClient()

    const { data: terminal } = await supabase
      .from("aingespace_terminals")
      .select("workspace_id")
      .eq("id", id)
      .single()

    if (!terminal) {
      return NextResponse.json({ error: "Terminal not found" }, { status: 404 })
    }

    const { data: workspace } = await supabase
      .from("aingespace_workspaces")
      .select("id")
      .eq("id", terminal.workspace_id)
      .eq("clerk_user_id", userId)
      .single()

    if (!workspace) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { error } = await supabase
      .from("aingespace_terminals")
      .delete()
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
