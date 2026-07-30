import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

// The sign-in/up paths must stay public even though no route lives there today.
// If they are protected, `auth.protect()` redirects them back to themselves and
// every hop appends another `redirect_url` — the URL grows until the request
// headers exceed the server limit and the browser reports HTTP 431 instead of
// anything that points at the real cause.
const isPublicRoute = createRouteMatcher([
  "/",
  "/api/webhook(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
