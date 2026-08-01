import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/clerk/auth"
import { createServerClient } from "@/lib/supabase/server"
import { encrypt } from "@/lib/supabase/encryption"
import { z } from "zod"

const upsertEnvSchema = z.object({
  // Matches env_vars_aingespace_key_format. Rejecting "npm run dev" here means
  // it never reaches the PTY environment as a broken variable name.
  key: z
    .string()
    .trim()
    .regex(/^[A-Za-z_][A-Za-z0-9_]{0,254}$/, "Key harus berupa nama variabel shell yang sah"),
  value: z.string().min(1).max(64 * 1024),
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
      .from("workspaces_aingespace")
      .select("id")
      .eq("id", workspaceId)
      .eq("clerk_user_id", userId)
      .maybeSingle()

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    // Ciphertext is deliberately absent from this listing; /decrypt is the one
    // endpoint that hands values back.
    const { data, error } = await supabase
      .from("env_vars_aingespace")
      .select("id, key, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .order("key", { ascending: true })

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
    const parsed = upsertEnvSchema.parse(body)

    const supabase = createServerClient()

    const { data: workspace } = await supabase
      .from("workspaces_aingespace")
      .select("id")
      .eq("id", workspaceId)
      .eq("clerk_user_id", userId)
      .maybeSingle()

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    // Upsert rather than insert: editing an existing variable is the common
    // case, and the old handler answered it with a 409 that left the caller to
    // delete and re-create the row just to change a value.
    const { data, error } = await supabase
      .from("env_vars_aingespace")
      .upsert(
        {
          workspace_id: workspaceId,
          key: parsed.key,
          value_encrypted: encrypt(parsed.value),
        },
        { onConflict: "workspace_id,key" }
      )
      .select("id, key, created_at, updated_at")
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
      .from("workspaces_aingespace")
      .select("id")
      .eq("id", workspaceId)
      .eq("clerk_user_id", userId)
      .maybeSingle()

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const { error } = await supabase
      .from("env_vars_aingespace")
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
