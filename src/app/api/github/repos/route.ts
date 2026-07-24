import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/clerk/auth"
import { createServerClient } from "@/lib/supabase/server"
import { decrypt } from "@/lib/supabase/encryption"

export async function GET() {
  try {
    const userId = await getAuthUserId()
    const supabase = createServerClient()

    const { data: connection } = await supabase
      .from("aingespace_github_connections")
      .select("*")
      .eq("clerk_user_id", userId)
      .single()

    if (!connection) {
      return NextResponse.json({ connected: false, repos: [] })
    }

    const accessToken = decrypt(connection.access_token)

    const reposResponse = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=30",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
        },
      }
    )

    if (!reposResponse.ok) {
      return NextResponse.json({ connected: true, repos: [] })
    }

    const repos = await reposResponse.json()

    const formattedRepos = repos.map((repo: Record<string, unknown>) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      description: repo.description,
      updatedAt: repo.updated_at,
      language: repo.language,
      stargazersCount: repo.stargazers_count,
    }))

    return NextResponse.json({
      connected: true,
      username: connection.github_username,
      repos: formattedRepos,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
