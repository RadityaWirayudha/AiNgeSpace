import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/clerk/auth"
import { createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
  githubRepo: z.string().min(1),
  githubBranch: z.string().default("main"),
  localPath: z.string().optional(),
})

export async function GET() {
  try {
    const userId = await getAuthUserId()
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from("aingespace_workspaces")
      .select("*")
      .eq("clerk_user_id", userId)
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
    const parsed = createWorkspaceSchema.parse(body)

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from("aingespace_workspaces")
      .insert({
        clerk_user_id: userId,
        name: parsed.name,
        github_repo: parsed.githubRepo,
        github_branch: parsed.githubBranch,
        local_path: parsed.localPath ?? null,
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
