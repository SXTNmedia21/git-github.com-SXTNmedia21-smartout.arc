import { Bot, Settings, MessageSquare } from "lucide-react";
import Link from "next/link";

export default function AiPage() {
  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
            <Bot className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Mr. Botsson</h1>
            <p className="text-sm text-zinc-500">AI-kollega for ansatte</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/dashboard/ai/config"
          className="group flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-indigo-500/30 hover:bg-zinc-900"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 transition-colors group-hover:bg-indigo-500/20">
            <Settings className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="font-semibold text-zinc-100">Konfigurasjon</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Kontroller autoritetsnivåer for Mr. Botssons kapabiliteter
            </p>
          </div>
        </Link>

        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
            <MessageSquare className="h-6 w-6 text-zinc-500" />
          </div>
          <div>
            <h2 className="font-semibold text-zinc-400">Chat</h2>
            <p className="mt-1 text-sm text-zinc-600">Snakk med Mr. Botsson — kommer snart</p>
          </div>
        </div>
      </div>
    </>
  );
}
