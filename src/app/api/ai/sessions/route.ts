import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/clerk/auth"
import { createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const createSessionSchema = z.object({
  workspaceId: z.string().uuid(),
  provider: z.string().min(1),
  model: z.string().min(1),
  prompt: z.string().min(1),
  response: z.string().optional(),
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

    const { data, error } = await supabase
      .from("aingespace_ai_sessions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })

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
    const parsed = createSessionSchema.parse(body)

    const supabase = createServerClient()

    const { data: workspace } = await supabase
      .from("aingespace_workspaces")
      .select("id")
      .eq("id", parsed.workspaceId)
      .eq("clerk_user_id", userId)
      .single()

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const { data, error } = await supabase
      .from("aingespace_ai_sessions")
      .insert({
        workspace_id: parsed.workspaceId,
        provider: parsed.provider,
        model: parsed.model,
        prompt: parsed.prompt,
        response: parsed.response ?? null,
      })
      .select()
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
