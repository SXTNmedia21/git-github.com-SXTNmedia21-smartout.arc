"use client";

import Image from "next/image";
import { m } from "framer-motion";
import type { BlockProps, ImageSectionContent } from "../../lib/block-schemas";
import { getPaddingClasses, getLayoutClasses, getBackgroundClasses } from "./block-helpers";

const maxWidthClass: Record<ImageSectionContent["max_width"], string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  full: "max-w-full",
};

export default function ImageSectionBlock({ content, settings }: BlockProps<ImageSectionContent>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const src = supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/landing-media/${content.image.media_id}`
    : `/landing-media/${content.image.media_id}`;

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
        <figure className={`mx-auto ${maxWidthClass[content.max_width]}`}>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <Image
              src={src}
              alt={content.image.alt || ""}
              width={1200}
              height={675}
              className="h-auto w-full object-cover"
            />
          </div>
          {content.caption && (
            <figcaption className="mt-4 text-center text-sm text-zinc-500">
              {content.caption}
            </figcaption>
          )}
        </figure>
      </m.div>
    </section>
  );
}
