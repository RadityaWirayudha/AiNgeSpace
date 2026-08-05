import type { FileNode } from "@/types"

export const mockFileTree: FileNode[] = [
  {
    name: "src",
    type: "directory",
    path: "src",
    children: [
      {
        name: "app",
        type: "directory",
        path: "src/app",
        children: [
          { name: "layout.tsx", type: "file", path: "src/app/layout.tsx" },
          { name: "page.tsx", type: "file", path: "src/app/page.tsx" },
          { name: "globals.css", type: "file", path: "src/app/globals.css" },
        ],
      },
      {
        name: "components",
        type: "directory",
        path: "src/components",
        children: [
          { name: "Header.tsx", type: "file", path: "src/components/Header.tsx" },
          { name: "Explorer.tsx", type: "file", path: "src/components/Explorer.tsx" },
        ],
      },
      {
        name: "features",
        type: "directory",
        path: "src/features",
        children: [
          {
            name: "terminal",
            type: "directory",
            path: "src/features/terminal",
            children: [
              { name: "TerminalPanel.tsx", type: "file", path: "src/features/terminal/TerminalPanel.tsx" },
              { name: "TerminalToolbar.tsx", type: "file", path: "src/features/terminal/TerminalToolbar.tsx" },
              { name: "TerminalManager.tsx", type: "file", path: "src/features/terminal/TerminalManager.tsx" },
            ],
          },
        ],
      },
    ],
  },
  { name: "package.json", type: "file", path: "package.json" },
  { name: "tsconfig.json", type: "file", path: "tsconfig.json" },
  { name: "next.config.ts", type: "file", path: "next.config.ts" },
  { name: "README.md", type: "file", path: "README.md" },
]
