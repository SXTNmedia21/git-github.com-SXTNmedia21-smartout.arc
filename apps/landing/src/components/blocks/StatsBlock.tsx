"use client";

import { m } from "framer-motion";
import type { BlockProps, StatsContent } from "../../lib/block-schemas";
import { getPaddingClasses, getLayoutClasses, getBackgroundClasses } from "./block-helpers";

export default function StatsBlock({ content, settings }: BlockProps<StatsContent>) {
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

        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {content.items.map((item, idx) => (
            <m.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="text-center"
            >
              <p className="text-foreground text-4xl font-black lg:text-5xl">
                {item.value}
                {item.suffix && <span className="text-muted-foreground">{item.suffix}</span>}
              </p>
              <p className="text-muted-foreground mt-2 text-sm lg:text-base">{item.label}</p>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
}
