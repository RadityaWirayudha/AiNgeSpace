"use client"

import { use } from "react"
import { WorkspaceView } from "@/features/workspace/WorkspaceView"

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return <WorkspaceView workspaceName={id} />
}
