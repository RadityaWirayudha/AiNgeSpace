import { NextRequest, NextResponse } from "next/server"
import { createAuthedClient, type SupabaseServerClient } from "@/lib/supabase/server"
import { encrypt } from "@/lib/supabase/encryption"
import { isUuid } from "@/lib/uuid"
import { z } from "zod"

/**
 * Every handler here is scoped to a workspace the caller owns. A malformed id
 * is rejected before the query: `.eq("id", …)` against a uuid column makes
 * Postgres reject the comparison outright, which turned a plain 404 into a 500.
 */
async function ownsWorkspace(
  supabase: SupabaseServerClient,
  userId: string,
  workspaceId: string
): Promise<boolean> {
  if (!isUuid(workspaceId)) return false

  const { data } = await supabase
    .from("workspaces_purpspace")
    .select("id")
    .eq("id", workspaceId)
    .eq("clerk_user_id", userId)
    .maybeSingle()

  return !!data
}

const upsertEnvSchema = z.object({
  // Matches env_vars_purpspace_key_format. Rejecting "npm run dev" here means
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
    const { supabase, userId } = await createAuthedClient()
    const { workspaceId } = await params

    if (!(await ownsWorkspace(supabase, userId, workspaceId))) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    // Ciphertext is deliberately absent from this listing; /decrypt is the one
    // endpoint that hands values back.
    const { data, error } = await supabase
      .from("env_vars_purpspace")
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
    const { supabase, userId } = await createAuthedClient()
    const { workspaceId } = await params
    const body = await request.json()
    const parsed = upsertEnvSchema.parse(body)

    if (!(await ownsWorkspace(supabase, userId, workspaceId))) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    // Upsert rather than insert: editing an existing variable is the common
    // case, and the old handler answered it with a 409 that left the caller to
    // delete and re-create the row just to change a value.
    const { data, error } = await supabase
      .from("env_vars_purpspace")
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
    const { supabase, userId } = await createAuthedClient()
    const { workspaceId } = await params
    const { searchParams } = new URL(request.url)
    const envId = searchParams.get("id")

    // Same reason as the workspace id: a non-uuid reaching `.eq("id", …)` is a
    // 500 from Postgres, not the 400 the caller deserves.
    if (!envId || !isUuid(envId)) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    if (!(await ownsWorkspace(supabase, userId, workspaceId))) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const { error } = await supabase
      .from("env_vars_purpspace")
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
