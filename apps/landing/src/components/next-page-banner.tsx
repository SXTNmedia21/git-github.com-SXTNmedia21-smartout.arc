import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface NextPageBannerProps {
  href: string;
  title: string;
  subtitle: string;
  color?: string;
}

export default function NextPageBanner({
  href,
  title,
  subtitle,
  color = "from-foreground/5",
}: NextPageBannerProps) {
  return (
    <div className="mx-auto mt-24 mb-12 w-full max-w-6xl px-4 sm:px-6">
      <Link
        href={href}
        className="group border-border bg-background/80 hover:border-border relative block overflow-hidden rounded-[40px] border p-10 text-center shadow-2xl backdrop-blur-3xl transition-all duration-500 hover:shadow-[0_0_80px_rgba(255,255,255,0.05)] md:p-16"
      >
        <div
          className={`absolute inset-0 bg-gradient-to-t ${color} to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100`}
        />

        {/* Ambient glow in background */}
        <div className="bg-foreground/5 pointer-events-none absolute top-1/2 left-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 opacity-0 blur-[100px] transition-opacity duration-700 group-hover:opacity-100" />

        <div className="relative z-10 flex flex-col items-center gap-4">
          <span className="text-muted-foreground text-sm font-bold tracking-widest uppercase">
            {subtitle}
          </span>
          <h2 className="text-foreground flex flex-col items-center justify-center gap-4 text-3xl font-black transition-all sm:flex-row sm:gap-6 md:text-5xl">
            {title}
            <div className="bg-foreground/10 group-hover:bg-foreground group-hover:text-background mt-4 flex h-12 w-12 items-center justify-center rounded-full transition-all duration-500 sm:mt-0 md:h-16 md:w-16">
              <ArrowRight className="h-6 w-6 transition-transform duration-300 group-hover:translate-x-1 md:h-8 md:w-8" />
            </div>
          </h2>
        </div>
      </Link>
    </div>
  );
}
