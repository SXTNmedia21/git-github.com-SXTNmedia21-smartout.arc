import type { PublicSectionProps } from "./types";

type PreviewItem = {
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  imageAssetId?: string;
};

export function MenuPreviewPublic({ content, assets }: PublicSectionProps) {
  const heading = content.heading as string | undefined;
  const items = (content.items as PreviewItem[] | undefined) ?? [];
  const ctaText = content.ctaText as string | undefined;
  const ctaUrl = content.ctaUrl as string | undefined;

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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => {
            const image = item.imageAssetId ? assets.byId[item.imageAssetId] : undefined;
            return (
              <div
                key={i}
                className="site-bg-muted overflow-hidden"
                style={{ borderRadius: "var(--site-radius)", boxShadow: "var(--site-shadow)" }}
              >
                {image && (
                  <img
                    src={`${assets.storageBaseUrl}/${image.storagePath}`}
                    alt={image.alt}
                    className="h-48 w-full object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{item.name}</h3>
                    {item.price != null && (
                      <span className="text-sm font-medium whitespace-nowrap">
                        {item.currency ?? "NOK"} {item.price}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-1 text-sm text-[var(--site-muted-foreground)]">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {ctaText && ctaUrl && (
          <div className="mt-10 text-center">
            <a
              href={ctaUrl}
              className="inline-block px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--site-primary)", borderRadius: "var(--site-radius)" }}
            >
              {ctaText}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
