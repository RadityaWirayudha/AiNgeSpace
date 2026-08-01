import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/clerk/auth"
import { createServerClient } from "@/lib/supabase/server"
import { decrypt } from "@/lib/supabase/encryption"
import { isUuid } from "@/lib/uuid"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const userId = await getAuthUserId()
    const { workspaceId } = await params
    const supabase = createServerClient()

    // A non-uuid id would make Postgres reject the comparison and answer 500
    // where the caller should simply be told the workspace is not theirs.
    const { data: workspace } = isUuid(workspaceId)
      ? await supabase
          .from("workspaces_aingespace")
          .select("id")
          .eq("id", workspaceId)
          .eq("clerk_user_id", userId)
          .maybeSingle()
      : { data: null }

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const { data, error } = await supabase
      .from("env_vars_aingespace")
      .select("id, key, value_encrypted, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .order("key", { ascending: true })

    if (error) throw error

    // One unreadable row — a value written under a rotated ENCRYPTION_KEY —
    // used to throw and take the whole response with it, hiding every other
    // variable. The bad row is reported instead so the UI can flag it.
    const decrypted = data.map((env) => {
      try {
        return {
          id: env.id,
          key: env.key,
          value: decrypt(env.value_encrypted),
          created_at: env.created_at,
          updated_at: env.updated_at,
        }
      } catch {
        return {
          id: env.id,
          key: env.key,
          value: null,
          error: "decrypt_failed" as const,
          created_at: env.created_at,
          updated_at: env.updated_at,
        }
      }
    })

    return NextResponse.json(decrypted)
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
