"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { BlockProps, CtaSectionContent } from "../../lib/block-schemas";
import { getPaddingClasses, getLayoutClasses } from "./block-helpers";

const bgVariants: Record<CtaSectionContent["background"], string> = {
  dark: "bg-zinc-900/50",
  accent: "bg-[hsl(var(--accent)/0.1)]",
  gradient: "bg-gradient-to-b from-transparent via-white/[0.03] to-transparent",
};

export default function CtaSectionBlock({ content, settings }: BlockProps<CtaSectionContent>) {
  return (
    <section
      className={`relative px-6 ${getPaddingClasses(settings.padding)} ${bgVariants[content.background]}`}
    >
      <m.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className={`mx-auto ${getLayoutClasses(settings.layout)} text-center`}
      >
        <h2 className="mb-6 text-4xl font-bold tracking-tight text-white lg:text-5xl">
          {content.heading}
        </h2>

        {content.subheading && (
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-zinc-400">
            {content.subheading}
          </p>
        )}

        {content.buttons.length > 0 && (
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            {content.buttons.map((button) => {
              if (button.style === "outline") {
                return (
                  <Link
                    key={button.label}
                    href={button.href}
                    className="flex items-center justify-center gap-2 rounded-full border border-white/20 px-8 py-4 font-bold text-white transition-all hover:border-white/40 hover:bg-white/5"
                  >
                    {button.label}
                  </Link>
                );
              }
              if (button.style === "ghost") {
                return (
                  <Link
                    key={button.label}
                    href={button.href}
                    className="flex items-center justify-center gap-2 px-8 py-4 font-bold text-zinc-400 transition-colors hover:text-white"
                  >
                    {button.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                );
              }
              return (
                <Link
                  key={button.label}
                  href={button.href}
                  className="flex items-center justify-center gap-2 rounded-full bg-white px-10 py-4 text-lg font-bold text-zinc-950 transition-all hover:bg-zinc-200"
                >
                  {button.label}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              );
            })}
          </div>
        )}
      </m.div>
    </section>
  );
}
