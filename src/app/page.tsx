import Link from "next/link"
import { Terminal, ArrowRight, GitBranch, Zap, SplitSquareHorizontal, Bot, Palette, Shield, Gauge, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-purple/[0.06] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[500px] bg-violet/[0.04] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-[-150px] w-[400px] h-[400px] bg-purple/[0.03] rounded-full blur-[100px] pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between px-6 lg:px-8 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-gradient-to-br from-purple/15 to-violet/10 border border-purple/15 flex items-center justify-center">
            <Terminal className="size-4.5 text-purple" />
          </div>
          <span className="text-sm font-bold tracking-tight">AiNgeSpace</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/workspace/demo">
            <Button variant="ghost" size="sm" className="gap-2 text-zinc-400 hover:text-foreground text-xs">
              Demo
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="sm" className="gap-2 bg-purple hover:bg-purple-dark text-white text-xs font-medium glow-purple-sm">
              Open Dashboard
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple/15 bg-purple/[0.06] text-purple-light text-xs font-medium mb-8 backdrop-blur-sm">
            <Zap className="size-3" />
            Browser-first AI Coding Terminal
          </div>

          <h1 className="animate-fade-in-up-delay-1 text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
            <span className="text-foreground">One Browser.</span>
            <br />
            <span className="text-zinc-400">One Repository.</span>
            <br />
            <span className="text-gradient-purple">
              Unlimited Terminals.
            </span>
          </h1>

          <p className="animate-fade-in-up-delay-2 text-zinc-400 text-lg sm:text-xl leading-relaxed mb-12 max-w-2xl mx-auto">
            Run Claude Code, OpenCode, Git, npm, and your full development workflow
            directly from the browser. No setup. No config. Just code.
          </p>

          <div className="animate-fade-in-up-delay-3 flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Link href="/dashboard">
              <Button size="lg" className="gap-2.5 bg-purple hover:bg-purple-dark text-white px-10 py-6 glow-purple-sm font-medium text-sm rounded-xl">
                <GitBranch className="size-4" />
                Connect GitHub
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/workspace/demo">
              <Button variant="outline" size="lg" className="gap-2.5 border-white/10 hover:border-white/20 text-zinc-300 px-10 py-6 text-sm rounded-xl">
                <Terminal className="size-4" />
                Try Demo
              </Button>
            </Link>
          </div>

          <div className="animate-fade-in-up-delay-4 relative">
            <div className="absolute -inset-1 bg-gradient-to-b from-purple/10 via-purple/5 to-transparent rounded-2xl blur-sm pointer-events-none" />
            <div className="terminal-chrome rounded-2xl overflow-hidden shadow-2xl shadow-black/60 relative">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-[#0c0c0f]">
                <div className="flex gap-2">
                  <div className="size-3 rounded-full bg-red-500/70 hover:bg-red-500 transition-colors" />
                  <div className="size-3 rounded-full bg-yellow-500/70 hover:bg-yellow-500 transition-colors" />
                  <div className="size-3 rounded-full bg-green-500/70 hover:bg-green-500 transition-colors" />
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/[0.03] border border-white/[0.04]">
                    <Terminal className="size-3 text-zinc-500" />
                    <span className="text-[11px] text-zinc-500 font-mono">~/workspace/aisingespace</span>
                  </div>
                </div>
              </div>
              <div className="bg-[#09090b] p-6 text-left font-mono text-sm leading-relaxed">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-purple font-bold">❯</span>
                  <span className="text-zinc-300">git clone https://github.com/user/app.git</span>
                </div>
                <div className="text-zinc-500 mb-4 ml-5">Cloning into &apos;app&apos;... done.</div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-purple font-bold">❯</span>
                  <span className="text-zinc-300">opencode</span>
                </div>
                <div className="text-zinc-400 mb-1 ml-5">
                  <span className="text-green-400">●</span> Connected to Claude Sonnet 4
                </div>
                <div className="text-zinc-400 mb-4 ml-5">
                  <span className="text-zinc-600">╭─</span> <span className="text-zinc-300">Refactoring auth module...</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-purple font-bold">❯</span>
                  <span className="text-zinc-300">npm run dev</span>
                </div>
                <div className="text-green-400/80 ml-5">
                  ▲ Ready on <span className="text-zinc-300">localhost:3000</span>
                  <span className="inline-block w-2 h-4 bg-zinc-500 ml-1 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="relative z-10 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <h2 className="text-2xl font-bold tracking-tight mb-3">Built for developers who ship</h2>
            <p className="text-sm text-zinc-500 max-w-md mx-auto">
              Everything you need in a cloud development environment, without the overhead.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: SplitSquareHorizontal,
                label: "Multi Terminal",
                desc: "Split, duplicate, and manage up to four terminals side by side in a grid layout.",
              },
              {
                icon: Bot,
                label: "AI Native",
                desc: "Run Claude Code and OpenCode directly in your terminal with full tool access.",
              },
              {
                icon: Palette,
                label: "Developer First",
                desc: "Built for developers who live in the terminal. Git, npm, SSH — all in one place.",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="group p-6 rounded-xl card-surface hover:border-purple/20 transition-all duration-300"
              >
                <div className="size-10 rounded-xl bg-purple/10 border border-purple/10 flex items-center justify-center mb-5 group-hover:bg-purple/15 group-hover:scale-105 transition-all duration-300">
                  <item.icon className="size-5 text-purple" />
                </div>
                <div className="text-sm font-semibold text-foreground mb-2">
                  {item.label}
                </div>
                <div className="text-xs text-zinc-500 leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            {[
              {
                icon: Shield,
                label: "Secure",
                desc: "Isolated containers with built-in security. Your code stays on your machine.",
              },
              {
                icon: Gauge,
                label: "Fast",
                desc: "Sub-second cold starts powered by Turbopack. No waiting around.",
              },
              {
                icon: Globe,
                label: "Accessible",
                desc: "Works on any device with a browser. No local installs required.",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="group p-6 rounded-xl card-surface hover:border-purple/20 transition-all duration-300"
              >
                <div className="size-10 rounded-xl bg-purple/10 border border-purple/10 flex items-center justify-center mb-5 group-hover:bg-purple/15 group-hover:scale-105 transition-all duration-300">
                  <item.icon className="size-5 text-purple" />
                </div>
                <div className="text-sm font-semibold text-foreground mb-2">
                  {item.label}
                </div>
                <div className="text-xs text-zinc-500 leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="relative z-10 px-6 py-5 border-t border-white/[0.06]">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <span className="text-xs text-zinc-600">
            AiNgeSpace MVP v1
          </span>
          <div className="flex items-center gap-5 text-xs text-zinc-600">
            <Link href="/dashboard" className="hover:text-zinc-400 transition-colors">Dashboard</Link>
            <Link href="/workspace/demo" className="hover:text-zinc-400 transition-colors">Demo</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
