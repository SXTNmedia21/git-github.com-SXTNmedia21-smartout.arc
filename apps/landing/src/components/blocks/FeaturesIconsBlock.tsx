"use client";

import { m } from "framer-motion";
import type { BlockProps, FeaturesIconsContent } from "../../lib/block-schemas";
import { resolveIcon } from "./icon-map";
import { getPaddingClasses, getLayoutClasses, getBackgroundClasses } from "./block-helpers";

export default function FeaturesIconsBlock({
  content,
  settings,
}: BlockProps<FeaturesIconsContent>) {
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
            className="mb-16 text-center text-3xl font-bold text-white lg:text-4xl"
          >
            {content.heading}
          </m.h2>
        )}

        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-10">
          {content.items.map((item, idx) => {
            const Icon = resolveIcon(item.icon);
            return (
              <m.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="flex flex-col items-center rounded-3xl border border-white/10 bg-white/5 p-8 lg:p-12"
              >
                <Icon
                  className="mb-6 h-20 w-20 text-white lg:h-28 lg:w-28"
                  aria-label={item.label}
                  role="img"
                />
                <span className="text-center text-xl font-bold text-white">{item.label}</span>
              </m.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
