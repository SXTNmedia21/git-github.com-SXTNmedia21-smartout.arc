"use client";

import { m } from "framer-motion";
import { Quote } from "lucide-react";
import type { BlockProps, CaseStudyContent } from "../../lib/block-schemas";
import { getPaddingClasses, getLayoutClasses, getBackgroundClasses } from "./block-helpers";

export default function CaseStudyBlock({ content, settings }: BlockProps<CaseStudyContent>) {
  return (
    <section
      className={`px-6 ${getPaddingClasses(settings.padding)} ${getBackgroundClasses(settings.background)}`}
    >
      <div className={`mx-auto ${getLayoutClasses(settings.layout)}`}>
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
        >
          {/* Header */}
          <div className="border-b border-white/10 px-8 py-6">
            <p className="mb-1 text-xs font-bold tracking-wider text-zinc-500 uppercase">
              Casestudie
            </p>
            <h3 className="text-2xl font-extrabold text-white">{content.heading}</h3>
            <p className="mt-1 text-sm text-zinc-400">{content.company}</p>
          </div>

          {/* Metrics grid */}
          {content.metrics.length > 0 && (
            <div
              className={`grid gap-px bg-white/5 ${
                content.metrics.length === 2
                  ? "grid-cols-2"
                  : content.metrics.length >= 3
                    ? "grid-cols-3"
                    : "grid-cols-1"
              }`}
            >
              {content.metrics.map((metric) => (
                <div key={metric.label} className="bg-zinc-950 p-6 text-center">
                  <p className="text-3xl font-black text-white">{metric.value}</p>
                  <p className="mt-1 text-xs text-zinc-500">{metric.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Quote */}
          {content.quote && (
            <div className="border-t border-white/10 px-8 py-6">
              <div className="flex items-start gap-3">
                <Quote className="mt-0.5 h-5 w-5 shrink-0 text-white/20" />
                <div>
                  <p className="text-sm leading-relaxed text-zinc-300 italic">
                    &ldquo;{content.quote}&rdquo;
                  </p>
                  {content.author_name && (
                    <p className="mt-2 text-xs text-zinc-500">
                      &mdash; {content.author_name}
                      {content.author_role && `, ${content.author_role}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </m.div>
      </div>
    </section>
  );
}
