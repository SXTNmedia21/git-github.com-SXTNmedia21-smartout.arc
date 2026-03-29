"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { BlockProps, CtaSectionContent } from "../../lib/block-schemas";
import { getPaddingClasses, getLayoutClasses } from "./block-helpers";

const bgVariants: Record<CtaSectionContent["background"], string> = {
  dark: "bg-muted",
  accent: "bg-[hsl(var(--accent)/0.1)]",
  gradient: "bg-gradient-to-b from-transparent via-foreground/[0.03] to-transparent",
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
        <h2 className="text-foreground mb-6 text-4xl font-bold tracking-tight lg:text-5xl">
          {content.heading}
        </h2>

        {content.subheading && (
          <p className="text-muted-foreground mx-auto mb-10 max-w-2xl text-lg leading-relaxed">
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
                    className="border-border text-foreground hover:border-foreground/40 hover:bg-foreground/5 flex items-center justify-center gap-2 rounded-full border px-8 py-4 font-bold transition-all"
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
                    className="text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 px-8 py-4 font-bold transition-colors"
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
                  className="bg-foreground text-background hover:bg-foreground/90 flex items-center justify-center gap-2 rounded-full px-10 py-4 text-lg font-bold transition-all"
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
