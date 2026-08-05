"use client"

import { ClerkProvider as BaseClerkProvider } from "@clerk/nextjs"
import { useState, useEffect, type ReactNode } from "react"
import { DesktopAuthBridge } from "@/features/desktop/DesktopAuthBridge"

export function ClerkProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <BaseClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
    >
      {/* Must sit inside the provider: it calls `useSignIn()`, which needs a
          Clerk context that only exists in this branch. */}
      <DesktopAuthBridge />
      {children}
    </BaseClerkProvider>
  )
}
