"use client";

import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";

export default function Navigation() {
    return (
        <nav className="fixed top-0 left-0 w-full z-40 border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-3xl">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-orange-500" />
                    <span className="text-xl font-black tracking-tighter text-white">SmartOut</span>
                </Link>
                <div className="flex items-center gap-6">
                    <Link href="/om-oss" className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors hidden md:block">Om Oss</Link>
                    <Link href="/pricing" className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors hidden md:block">Priser</Link>
                    <Link href="/blog" className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors hidden md:block">Kundehistorier</Link>
                    <Link href="/#workspace" className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors hidden md:block">Konsepter</Link>
                    <Link href="/#features" className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors hidden md:block">Funksjoner</Link>
                    <Link href="http://localhost:3050/dashboard" className="text-sm font-bold text-zinc-950 bg-white hover:bg-zinc-200 px-5 py-2 rounded-full transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                        Gå til Dashboard <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </nav>
    );
}
