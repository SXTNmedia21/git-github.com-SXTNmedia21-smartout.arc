import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import { WEB_APP_LINKS } from "../lib/web-app-url";

export default function Navigation() {
  return (
    <nav className="fixed top-0 left-0 z-40 w-full border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-3xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-orange-500" />
          <span className="text-xl font-black tracking-tighter text-white">SmartOut</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/om-oss"
            className="hidden text-sm font-semibold text-zinc-400 transition-colors hover:text-white md:block"
          >
            Om Oss
          </Link>
          <Link
            href="/pricing"
            className="hidden text-sm font-semibold text-zinc-400 transition-colors hover:text-white md:block"
          >
            Priser
          </Link>
          <Link
            href="/blog"
            className="hidden text-sm font-semibold text-zinc-400 transition-colors hover:text-white md:block"
          >
            Kundehistorier
          </Link>
          <Link
            href="/docs"
            className="hidden text-sm font-semibold text-zinc-400 transition-colors hover:text-white md:block"
          >
            Dokumentasjon
          </Link>
          <Link
            href="/#features"
            className="hidden text-sm font-semibold text-zinc-400 transition-colors hover:text-white md:block"
          >
            Funksjoner
          </Link>
          <Link
            href={WEB_APP_LINKS.dashboard}
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-colors hover:bg-zinc-200 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            Gå til Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
