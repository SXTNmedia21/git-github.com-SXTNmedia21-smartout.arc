"use client";

import { m } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { BlockProps, FaqContent } from "../../lib/block-schemas";
import { getPaddingClasses, getLayoutClasses, getBackgroundClasses } from "./block-helpers";

export default function FaqBlock({ content, settings }: BlockProps<FaqContent>) {
  return (
    <section
      className={`px-6 ${getPaddingClasses(settings.padding)} ${getBackgroundClasses(settings.background)}`}
    >
      <div className={`mx-auto ${getLayoutClasses(settings.layout)}`}>
        {content.heading && (
          <m.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-foreground mb-12 text-center text-4xl font-bold tracking-tight lg:text-5xl"
          >
            {content.heading}
          </m.h2>
        )}

        <div className="mx-auto max-w-3xl space-y-4">
          {content.items.map((item, idx) => (
            <m.details
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              className="group border-border bg-foreground/[0.03] open:bg-foreground/[0.05] rounded-xl border transition-all"
            >
              <summary className="text-foreground flex cursor-pointer items-center justify-between px-6 py-5 text-lg font-bold [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown className="text-muted-foreground h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-border text-muted-foreground border-t px-6 pt-4 pb-6 leading-relaxed">
                {item.answer}
              </div>
            </m.details>
          ))}
        </div>
      </div>
    </section>
  );
}
