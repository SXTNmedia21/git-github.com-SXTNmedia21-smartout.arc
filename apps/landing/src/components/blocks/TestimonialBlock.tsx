"use client";

import { m } from "framer-motion";
import { Quote } from "lucide-react";
import type { BlockProps, TestimonialContent } from "../../lib/block-schemas";
import { getPaddingClasses, getLayoutClasses, getBackgroundClasses } from "./block-helpers";

export default function TestimonialBlock({ content, settings }: BlockProps<TestimonialContent>) {
  return (
    <section
      className={`px-6 ${getPaddingClasses(settings.padding)} ${getBackgroundClasses(settings.background)}`}
    >
      <div className={`mx-auto ${getLayoutClasses(settings.layout)}`}>
        <m.blockquote
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-8 md:p-12"
        >
          <div className="flex items-start gap-5">
            <div className="hidden w-1 shrink-0 self-stretch rounded-full bg-white/20 sm:block" />
            <div className="flex-1">
              <Quote className="mb-4 h-6 w-6 text-white/30" />
              <p className="mb-6 text-lg leading-relaxed text-zinc-200 italic md:text-xl">
                &ldquo;{content.quote}&rdquo;
              </p>
              <div className="flex items-center gap-4">
                {content.image && (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                    <span className="text-sm font-bold text-white">{content.name.charAt(0)}</span>
                  </div>
                )}
                {!content.image && (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                    <span className="text-sm font-bold text-white">{content.name.charAt(0)}</span>
                  </div>
                )}
                <div>
                  <p className="font-bold text-white">{content.name}</p>
                  <p className="text-sm text-zinc-500">
                    {[content.role, content.company].filter(Boolean).join(", ")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </m.blockquote>
      </div>
    </section>
  );
}
