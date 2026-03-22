"use client";

import type { PublicSectionProps } from "./types";

export function MapPublic({ content }: PublicSectionProps) {
  const heading = content.heading as string | undefined;
  const embedUrl = content.embedUrl as string | undefined;
  const address = content.address as string | undefined;

  return (
    <section className="py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {heading && (
          <h2
            className="mb-8 text-center text-2xl font-bold md:text-3xl"
            style={{ fontFamily: "var(--site-font-heading)" }}
          >
            {heading}
          </h2>
        )}
        {embedUrl ? (
          <div
            className="aspect-video w-full overflow-hidden"
            style={{ borderRadius: "var(--site-radius)" }}
          >
            <iframe
              src={embedUrl}
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={address ?? "Kart"}
              allowFullScreen
            />
          </div>
        ) : address ? (
          <p className="text-center text-[var(--site-muted-foreground)]">{address}</p>
        ) : null}
      </div>
    </section>
  );
}
