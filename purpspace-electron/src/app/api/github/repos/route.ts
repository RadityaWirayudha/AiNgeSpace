import { NextResponse } from "next/server"
import { createAuthedClient } from "@/lib/supabase/server"
import { decrypt } from "@/lib/supabase/encryption"

export async function GET() {
  try {
    const { supabase, userId } = await createAuthedClient()

    // maybeSingle: a user who has never connected GitHub is the normal case,
    // and `single()` treated it as an error that surfaced as a 500 instead of
    // the `connected: false` the caller expects.
    const { data: connection } = await supabase
      .from("purpspace_github_connections")
      .select("github_username, access_token_encrypted")
      .eq("clerk_user_id", userId)
      .maybeSingle()

    if (!connection) {
      return NextResponse.json({ connected: false, repos: [] })
    }

    const accessToken = decrypt(connection.access_token_encrypted)

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
