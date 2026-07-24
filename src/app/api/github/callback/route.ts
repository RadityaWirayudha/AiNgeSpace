import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/clerk/auth"
import { createServerClient } from "@/lib/supabase/server"
import { encrypt } from "@/lib/supabase/encryption"

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId()
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")

    if (!code) {
      return NextResponse.json({ error: "Missing code parameter" }, { status: 400 })
    }

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      return NextResponse.json({ error: tokenData.error_description }, { status: 400 })
    }

    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
      },
    })

    const githubUser = await userResponse.json()

    const supabase = createServerClient()

    const { data: existing } = await supabase
      .from("aingespace_github_connections")
      .select("id")
      .eq("clerk_user_id", userId)
      .single()

    const encryptedToken = encrypt(tokenData.access_token)

    if (existing) {
      const { error } = await supabase
        .from("aingespace_github_connections")
        .update({
          github_user_id: String(githubUser.id),
          github_username: githubUser.login,
          access_token: encryptedToken,
        })
        .eq("id", existing.id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from("aingespace_github_connections")
        .insert({
          clerk_user_id: userId,
          github_user_id: String(githubUser.id),
          github_username: githubUser.login,
          access_token: encryptedToken,
        })

      if (error) throw error
    }

    return NextResponse.redirect(new URL("/dashboard", request.url))
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
