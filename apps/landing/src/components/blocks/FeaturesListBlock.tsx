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
            className="mb-16 text-center text-4xl font-extrabold tracking-tight text-white lg:text-5xl"
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
                className="flex items-start gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-white/20"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-bold text-white">{item.title}</h3>
                  <p className="leading-relaxed text-zinc-400">{item.description}</p>
                </div>
              </m.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
