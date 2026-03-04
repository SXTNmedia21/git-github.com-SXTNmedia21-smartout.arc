"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { BlockProps, PricingPreviewContent } from "../../lib/block-schemas";
import { getPaddingClasses, getLayoutClasses, getBackgroundClasses } from "./block-helpers";

export default function PricingPreviewBlock({
  content,
  settings,
}: BlockProps<PricingPreviewContent>) {
  return (
    <section
      className={`px-6 ${getPaddingClasses(settings.padding)} ${getBackgroundClasses(settings.background)}`}
    >
      <m.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className={`mx-auto ${getLayoutClasses(settings.layout)} text-center`}
      >
        {content.heading && (
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white lg:text-4xl">
            {content.heading}
          </h2>
        )}

        {content.subheading && (
          <p className="mx-auto mb-8 max-w-2xl text-lg text-zinc-400">{content.subheading}</p>
        )}

        <Link
          href={content.cta_href}
          className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-bold text-zinc-950 transition-all hover:bg-zinc-200"
        >
          {content.cta_label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </m.div>
    </section>
  );
}
