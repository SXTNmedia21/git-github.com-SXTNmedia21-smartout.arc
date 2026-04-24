import { Bot, Settings, MessageSquare } from "lucide-react";
import Link from "next/link";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

/**
 * /dashboard/ai — Server Component shell.
 *
 * Pure static index for Mr. Botsson with no client island: server-rendered
 * links + a feature-flagged "coming soon" card. Per ADR-0115 the RSC
 * migration pattern here is a no-op — the page is already a server
 * component. Loading.tsx uses @smartout/ui Skeleton primitives consistent
 * with the people/ reference. BotssonProvider/voice are intentionally
 * not wired here; those live further down the tree in dedicated surfaces.
 */
export default function AiPage() {
  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
            <Bot className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-foreground text-2xl font-bold tracking-tight">Mr. Botsson</h1>
            <p className="text-muted-foreground text-sm">AI-kollega for ansatte</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/dashboard/ai/config"
          className="group border-border bg-card/50 hover:bg-card flex flex-col gap-3 rounded-2xl border p-6 transition-all hover:border-indigo-500/30"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 transition-colors group-hover:bg-indigo-500/20">
            <Settings className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-foreground font-semibold">Konfigurasjon</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Kontroller autoritetsnivåer for Mr. Botssons kapabiliteter
            </p>
          </div>
        </Link>

        {FEATURE_FLAGS.AI_CHAT && (
          <div className="border-border bg-muted/30 flex flex-col gap-3 rounded-2xl border border-dashed p-6">
            <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-xl">
              <MessageSquare className="text-muted-foreground h-6 w-6" />
            </div>
            <div>
              <h2 className="text-muted-foreground font-semibold">Chat</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Snakk med Mr. Botsson — kommer snart
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
