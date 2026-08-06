import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** Convenience type so helpers in route files can annotate their `supabase` param. */
export type SupabaseServerClient = ReturnType<typeof createClient<Database>>

/**
 * Creates a Supabase client scoped to the caller's Clerk session.
 *
 * The Clerk session JWT is forwarded as the Authorization header. Supabase
 * verifies it via the Clerk JWKS endpoint configured under
 * Authentication → Third-party Auth in the project dashboard, then enforces
 * RLS using `(select auth.jwt()->>'sub')` as the user identity.
 *
 * Belt-and-suspenders: returns `userId` so callers can also add an explicit
 * `.eq("clerk_user_id", userId)` on top of the RLS filter — the redundant
 * check costs nothing and prevents a mis-configured policy from leaking data
 * if a policy is ever inadvertently dropped.
 *
 * Throws "Unauthorized" when there is no active session, so callers can keep
 * the same `error.message === "Unauthorized"` catch they already have.
 */
export async function createAuthedClient(): Promise<{
  supabase: SupabaseServerClient
  userId: string
}> {
  const { userId, getToken } = await auth()
  if (!userId) throw new Error("Unauthorized")

  // getToken() without a template name returns the raw Clerk session JWT.
  // Supabase verifies its signature against Clerk's JWKS URL — no JWT
  // template is required when using the native third-party auth integration.
  const token = await getToken()

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return { supabase, userId }
}
