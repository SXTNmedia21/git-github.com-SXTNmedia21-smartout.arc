import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface NextPageBannerProps {
    href: string;
    title: string;
    subtitle: string;
    color?: string;
}

export default function NextPageBanner({ href, title, subtitle, color = "from-white/5" }: NextPageBannerProps) {
    return (
        <div className="w-full max-w-6xl mx-auto mt-24 mb-12 px-4 sm:px-6">
            <Link href={href} className="group relative block rounded-[40px] bg-[#0a0a0c]/80 border border-white/10 hover:border-white/20 transition-all duration-500 overflow-hidden backdrop-blur-3xl p-10 md:p-16 text-center shadow-2xl hover:shadow-[0_0_80px_rgba(255,255,255,0.05)]">
                <div className={`absolute inset-0 bg-gradient-to-t ${color} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />

                {/* Ambient glow in background */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-white/5 blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center gap-4">
                    <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest">{subtitle}</span>
                    <h2 className="text-3xl md:text-5xl font-black text-white transition-all flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
                        {title}
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all duration-500 mt-4 sm:mt-0">
                            <ArrowRight className="w-6 h-6 md:w-8 md:h-8 group-hover:translate-x-1 transition-transform duration-300" />
                        </div>
                    </h2>
                </div>
            </Link>
        </div>
    );
}
