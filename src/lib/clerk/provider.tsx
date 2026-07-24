"use client"

import { ClerkProvider as BaseClerkProvider } from "@clerk/nextjs"
import type { ReactNode } from "react"

export function ClerkProvider({ children }: { children: ReactNode }) {
  return (
    <BaseClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
    >
      {children}
    </BaseClerkProvider>
  )
}
