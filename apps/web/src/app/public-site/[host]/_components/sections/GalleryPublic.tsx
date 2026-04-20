import Image from "next/image";
import type { PublicSectionProps } from "./types";

export function GalleryPublic({ content, assets }: PublicSectionProps) {
  const heading = content.heading as string | undefined;
  const imageAssetIds = (content.imageAssetIds as string[] | undefined) ?? [];

  return (
    <section className="py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {heading && (
          <h2
            className="mb-10 text-center text-2xl font-bold md:text-3xl"
            style={{ fontFamily: "var(--site-font-heading)" }}
          >
            {heading}
          </h2>
        )}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {imageAssetIds.map((assetId) => {
            const image = assets.byId[assetId];
            if (!image) return null;
            return (
              <div
                key={assetId}
                className="relative aspect-square overflow-hidden"
                style={{ borderRadius: "var(--site-radius)" }}
              >
                <Image
                  src={`${assets.storageBaseUrl}/${image.storagePath}`}
                  alt={image.alt}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover transition-transform duration-300 hover:scale-105"
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
