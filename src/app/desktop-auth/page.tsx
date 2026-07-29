import { auth, clerkClient } from "@clerk/nextjs/server"
import { DesktopAuthHandoff } from "./DesktopAuthHandoff"

/**
 * The browser half of desktop sign-in.
 *
 * The Electron window and the user's real browser keep separate cookie jars, so
 * a session established in the browser cannot simply be read by the app. This
 * page is opened in the browser, is protected like any other route (so Clerk's
 * proxy sends the visitor through the normal hosted sign-in first), and once a
 * session exists it mints a short-lived sign-in token for that same user. The
 * token travels back over the `aingespace://` deep link and the renderer trades
 * it for a session of its own — see `DesktopAuthBridge`.
 *
 * OAuth is deliberately never rendered inside the Electron window; that is the
 * whole reason for the round trip.
 */

// The token must be minted per visit, so this page can never be prerendered.
export const dynamic = "force-dynamic"

/** Long enough to survive a slow redirect, short enough to be worthless if the
 *  URL is ever left behind in browser history. Sign-in tokens are single-use. */
const TICKET_TTL_SECONDS = 60

export default async function DesktopAuthPage() {
  const { userId, redirectToSignIn } = await auth()

  // The proxy should have handled this already; this covers the case where the
  // route's matcher changes and stops covering the page.
  if (!userId) return redirectToSignIn()

  const client = await clerkClient()
  const { token } = await client.signInTokens.createSignInToken({
    userId,
    expiresInSeconds: TICKET_TTL_SECONDS,
  })

  return <DesktopAuthHandoff ticket={token} />
}
