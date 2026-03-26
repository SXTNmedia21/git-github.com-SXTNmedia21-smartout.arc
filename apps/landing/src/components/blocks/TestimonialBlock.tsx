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
          className="border-border bg-foreground/[0.03] mx-auto max-w-3xl rounded-2xl border p-8 md:p-12"
        >
          <div className="flex items-start gap-5">
            <div className="bg-foreground/20 hidden w-1 shrink-0 self-stretch rounded-full sm:block" />
            <div className="flex-1">
              <Quote className="text-foreground/30 mb-4 h-6 w-6" />
              <p className="text-foreground mb-6 text-lg leading-relaxed italic md:text-xl">
                &ldquo;{content.quote}&rdquo;
              </p>
              <div className="flex items-center gap-4">
                {content.image && (
                  <div className="bg-foreground/10 flex h-12 w-12 items-center justify-center rounded-full">
                    <span className="text-foreground text-sm font-bold">
                      {content.name.charAt(0)}
                    </span>
                  </div>
                )}
                {!content.image && (
                  <div className="bg-foreground/10 flex h-12 w-12 items-center justify-center rounded-full">
                    <span className="text-foreground text-sm font-bold">
                      {content.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-foreground font-bold">{content.name}</p>
                  <p className="text-muted-foreground text-sm">
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
