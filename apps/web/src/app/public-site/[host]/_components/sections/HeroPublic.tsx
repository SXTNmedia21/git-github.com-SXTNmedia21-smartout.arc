import Image from "next/image";
import type { PublicSectionProps } from "./types";

export function HeroPublic({ content, assets }: PublicSectionProps) {
  const heading = content.heading as string | undefined;
  const subheading = content.subheading as string | undefined;
  const ctaText = content.ctaText as string | undefined;
  const ctaUrl = content.ctaUrl as string | undefined;
  const imageAssetId = content.imageAssetId as string | undefined;

  const image = imageAssetId ? assets.byId[imageAssetId] : undefined;

  return (
    <section className="relative flex min-h-[60vh] items-center justify-center overflow-hidden px-4 py-20 text-center">
      {image && (
        <Image
          src={`${assets.storageBaseUrl}/${image.storagePath}`}
          alt={image.alt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      )}
      {image && <div className="absolute inset-0 bg-black/40" />}
      <div className="relative z-10 mx-auto max-w-3xl">
        {heading && (
          <h1
            className="mb-4 text-4xl font-bold md:text-5xl lg:text-6xl"
            style={{
              fontFamily: "var(--site-font-heading)",
              color: image ? "white" : "var(--site-foreground)",
            }}
          >
            {heading}
          </h1>
        )}
        {subheading && (
          <p
            className="mx-auto mb-8 max-w-2xl text-lg md:text-xl"
            style={{ color: image ? "rgba(255,255,255,0.9)" : "var(--site-muted-foreground)" }}
          >
            {subheading}
          </p>
        )}
        {ctaText && ctaUrl && (
          <a
            href={ctaUrl}
            className="inline-block px-8 py-3 font-medium text-white transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--site-primary)",
              borderRadius: "var(--site-radius)",
            }}
          >
            {ctaText}
          </a>
        )}
      </div>
    </section>
  );
}
