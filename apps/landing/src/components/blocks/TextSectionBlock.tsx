"use client";

import { m } from "framer-motion";
import type { BlockProps, TextSectionContent } from "../../lib/block-schemas";
import { getPaddingClasses, getLayoutClasses, getBackgroundClasses } from "./block-helpers";

export default function TextSectionBlock({ content, settings }: BlockProps<TextSectionContent>) {
  return (
    <section
      className={`px-6 ${getPaddingClasses(settings.padding)} ${getBackgroundClasses(settings.background)}`}
    >
      <m.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className={`mx-auto ${getLayoutClasses(settings.layout)}`}
      >
        <div className="mx-auto max-w-3xl">
          {content.heading && (
            <h2 className="mb-6 text-3xl font-extrabold tracking-tight text-white lg:text-4xl">
              {content.heading}
            </h2>
          )}

          {content.body && (
            <div className="prose prose-invert prose-zinc max-w-none leading-relaxed text-zinc-400">
              {content.body.split("\n\n").map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          )}
        </div>
      </m.div>
    </section>
  );
}
