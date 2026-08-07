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
 * The Clerk session JWT is forwarded via the `accessToken` option.
 * Supabase verifies it against Clerk's JWKS endpoint — configured once in the
 * Supabase dashboard at Authentication → Third-Party Auth (direct URL:
 * https://supabase.com/dashboard/project/<project-ref>/auth/third-party).
 * RLS policies identify the caller via `(select auth.jwt()->>'sub')`.
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

  // accessToken is called by supabase-js before each outgoing request.
  // No JWT template is needed — Supabase verifies the raw Clerk session token
  // using Clerk's public JWKS endpoint once Third-Party Auth is configured.
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    accessToken: () => getToken(),
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return { supabase, userId }
}
