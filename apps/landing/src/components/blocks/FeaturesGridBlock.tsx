"use client";

import { m } from "framer-motion";
import type { BlockProps, FeaturesGridContent } from "../../lib/block-schemas";
import { resolveIcon } from "./icon-map";
import { getPaddingClasses, getLayoutClasses, getBackgroundClasses } from "./block-helpers";

const columnsClass: Record<2 | 3 | 4, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
};

export default function FeaturesGridBlock({ content, settings }: BlockProps<FeaturesGridContent>) {
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

        <div className={`grid gap-8 ${columnsClass[content.columns]}`}>
          {content.items.map((item, idx) => {
            const Icon = resolveIcon(item.icon);
            return (
              <m.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="group border-border bg-foreground/[0.03] hover:border-border hover:bg-foreground/[0.05] rounded-2xl border p-8 transition-all"
              >
                <div className="bg-foreground/10 mb-5 flex h-12 w-12 items-center justify-center rounded-xl">
                  <Icon className="text-foreground h-6 w-6" />
                </div>
                <h3 className="text-foreground mb-3 text-xl font-bold">{item.title}</h3>
                {item.description && (
                  <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                )}
              </m.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
