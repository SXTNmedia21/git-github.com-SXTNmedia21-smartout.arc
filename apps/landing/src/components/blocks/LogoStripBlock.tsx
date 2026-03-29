"use client";

import Image from "next/image";
import { m } from "framer-motion";
import type { BlockProps, LogoStripContent } from "../../lib/block-schemas";
import { getPaddingClasses, getLayoutClasses, getBackgroundClasses } from "./block-helpers";

export default function LogoStripBlock({ content, settings }: BlockProps<LogoStripContent>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <section
      className={`px-6 ${getPaddingClasses(settings.padding)} ${getBackgroundClasses(settings.background)}`}
    >
      <div className={`mx-auto ${getLayoutClasses(settings.layout)}`}>
        {content.heading && (
          <m.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-muted-foreground mb-10 text-center text-sm font-bold tracking-wider uppercase"
          >
            {content.heading}
          </m.p>
        )}

        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-wrap items-center justify-center gap-8 md:gap-12"
        >
          {content.logos.map((logo) => {
            const src = supabaseUrl
              ? `${supabaseUrl}/storage/v1/object/public/landing-media/${logo.image.media_id}`
              : `/landing-media/${logo.image.media_id}`;

            return (
              <div
                key={logo.name}
                className="flex h-12 items-center opacity-50 transition-opacity hover:opacity-100"
              >
                <Image
                  src={src}
                  alt={logo.image.alt || logo.name}
                  width={120}
                  height={48}
                  className="h-8 w-auto object-contain md:h-10"
                />
              </div>
            );
          })}
        </m.div>
      </div>
    </section>
  );
}
