import type { PublicSectionProps } from "./types";

export function TextImagePublic({ content, assets }: PublicSectionProps) {
  const heading = content.heading as string | undefined;
  const text = content.text as string | undefined;
  const imageAssetId = content.imageAssetId as string | undefined;
  const imagePosition = (content.imagePosition as string) ?? "right";

  const image = imageAssetId ? assets.byId[imageAssetId] : undefined;

  return (
    <section className="py-12 md:py-16">
      <div
        className={`mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 sm:px-6 md:grid-cols-2 md:gap-12 lg:px-8 ${
          imagePosition === "left" ? "md:[direction:rtl]" : ""
        }`}
      >
        <div className={imagePosition === "left" ? "md:[direction:ltr]" : ""}>
          {heading && (
            <h2
              className="mb-4 text-2xl font-bold md:text-3xl"
              style={{ fontFamily: "var(--site-font-heading)" }}
            >
              {heading}
            </h2>
          )}
          {text && <p className="leading-relaxed text-[var(--site-muted-foreground)]">{text}</p>}
        </div>
        {image && (
          <div className={imagePosition === "left" ? "md:[direction:ltr]" : ""}>
            <img
              src={`${assets.storageBaseUrl}/${image.storagePath}`}
              alt={image.alt}
              className="h-auto w-full object-cover"
              style={{ borderRadius: "var(--site-radius)" }}
              width={image.width ?? undefined}
              height={image.height ?? undefined}
            />
          </div>
        )}
      </div>
    </section>
  );
}
