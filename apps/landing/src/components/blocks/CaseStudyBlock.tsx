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
          className="border-border bg-foreground/[0.03] mx-auto max-w-4xl overflow-hidden rounded-2xl border"
        >
          {/* Header */}
          <div className="border-border border-b px-8 py-6">
            <p className="text-muted-foreground mb-1 text-xs font-bold tracking-wider uppercase">
              Casestudie
            </p>
            <h3 className="text-foreground text-2xl font-bold">{content.heading}</h3>
            <p className="text-muted-foreground mt-1 text-sm">{content.company}</p>
          </div>

          {/* Metrics grid */}
          {content.metrics.length > 0 && (
            <div
              className={`bg-foreground/5 grid gap-px ${
                content.metrics.length === 2
                  ? "grid-cols-2"
                  : content.metrics.length >= 3
                    ? "grid-cols-3"
                    : "grid-cols-1"
              }`}
            >
              {content.metrics.map((metric) => (
                <div key={metric.label} className="bg-background p-6 text-center">
                  <p className="text-foreground text-3xl font-black">{metric.value}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{metric.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Quote */}
          {content.quote && (
            <div className="border-border border-t px-8 py-6">
              <div className="flex items-start gap-3">
                <Quote className="text-foreground/20 mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-foreground text-sm leading-relaxed italic">
                    &ldquo;{content.quote}&rdquo;
                  </p>
                  {content.author_name && (
                    <p className="text-muted-foreground mt-2 text-xs">
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
