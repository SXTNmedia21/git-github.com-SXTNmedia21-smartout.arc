"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { BlockProps, HeroContent } from "../../lib/block-schemas";
import { getPaddingClasses, getLayoutClasses, getBackgroundClasses } from "./block-helpers";

export default function HeroBlock({ content, settings }: BlockProps<HeroContent>) {
  const isCentered = content.alignment === "center";

  return (
    <section
      className={`relative px-6 ${getPaddingClasses(settings.padding)} ${getBackgroundClasses(settings.background)}`}
    >
      <div
        className={`mx-auto ${getLayoutClasses(settings.layout)} ${isCentered ? "text-center" : ""}`}
      >
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className={isCentered ? "mx-auto max-w-4xl" : "max-w-3xl"}
        >
          <h1 className="mb-6 text-5xl leading-[1.08] font-black tracking-tight text-white lg:text-7xl">
            {content.heading}
          </h1>

          {content.subheading && (
            <p className="mb-10 text-lg leading-relaxed text-zinc-400 lg:text-xl">
              {content.subheading}
            </p>
          )}

          {content.buttons.length > 0 && (
            <div
              className={`flex flex-col gap-4 sm:flex-row ${isCentered ? "justify-center" : ""}`}
            >
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
                // primary (default)
                return (
                  <Link
                    key={button.label}
                    href={button.href}
                    className="flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 font-bold text-zinc-950 transition-all hover:bg-zinc-200"
                  >
                    {button.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                );
              })}
            </div>
          )}
        </m.div>
      </div>
    </section>
  );
}
