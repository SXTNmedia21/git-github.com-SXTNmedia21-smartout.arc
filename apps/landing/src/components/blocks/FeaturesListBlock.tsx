"use client";

import { m } from "framer-motion";
import type { BlockProps, FeaturesListContent } from "../../lib/block-schemas";
import { resolveIcon } from "./icon-map";
import { getPaddingClasses, getLayoutClasses, getBackgroundClasses } from "./block-helpers";

export default function FeaturesListBlock({ content, settings }: BlockProps<FeaturesListContent>) {
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
            className="text-foreground mb-16 text-center text-4xl font-bold tracking-tight lg:text-5xl"
          >
            {content.heading}
          </m.h2>
        )}

        <div className="mx-auto max-w-3xl space-y-8">
          {content.items.map((item, idx) => {
            const Icon = resolveIcon(item.icon);
            return (
              <m.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                className="border-border bg-foreground/[0.03] hover:border-border flex items-start gap-6 rounded-2xl border p-6 transition-all"
              >
                <div className="bg-foreground/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                  <Icon className="text-foreground h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-foreground mb-2 text-lg font-bold">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </m.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
