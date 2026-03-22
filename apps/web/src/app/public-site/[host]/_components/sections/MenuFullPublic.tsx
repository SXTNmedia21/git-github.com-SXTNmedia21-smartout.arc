import type { PublicSectionProps } from "./types";
import type { SnapshotMenu } from "@smartout/website";

export function MenuFullPublic({ content, assets }: PublicSectionProps) {
  const heading = content.heading as string | undefined;
  const menus = (content.menus as SnapshotMenu[] | undefined) ?? [];

  return (
    <section className="py-12 md:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {heading && (
          <h2
            className="mb-10 text-center text-2xl font-bold md:text-3xl"
            style={{ fontFamily: "var(--site-font-heading)" }}
          >
            {heading}
          </h2>
        )}
        {menus.map((menu, mi) => (
          <div key={mi} className="mb-12 last:mb-0">
            <h3
              className="mb-2 text-xl font-bold"
              style={{ fontFamily: "var(--site-font-heading)" }}
            >
              {menu.name}
            </h3>
            {menu.description && (
              <p className="mb-6 text-[var(--site-muted-foreground)]">{menu.description}</p>
            )}

            {menu.sourceType === "pdf" && menu.pdfPath && (
              <a
                href={`${assets.storageBaseUrl}/${menu.pdfPath}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-6 inline-block border border-[var(--site-primary)] px-4 py-2 text-sm font-medium text-[var(--site-primary)] hover:opacity-80"
                style={{ borderRadius: "var(--site-radius)" }}
              >
                Last ned meny (PDF)
              </a>
            )}

            {menu.categories.map((cat, ci) => (
              <div key={ci} className="mb-8 last:mb-0">
                <h4 className="mb-1 text-lg font-semibold">{cat.name}</h4>
                {cat.description && (
                  <p className="mb-4 text-sm text-[var(--site-muted-foreground)]">
                    {cat.description}
                  </p>
                )}
                <div className="space-y-3">
                  {cat.items.map((item, ii) => (
                    <div
                      key={ii}
                      className="flex items-start justify-between gap-4 border-b border-[var(--site-muted)] py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{item.name}</span>
                        {item.description && (
                          <p className="mt-0.5 text-sm text-[var(--site-muted-foreground)]">
                            {item.description}
                          </p>
                        )}
                        {(item.allergens.length > 0 || item.dietaryTags.length > 0) && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.dietaryTags.map((tag) => (
                              <span
                                key={tag}
                                className="bg-[var(--site-accent)]/10 px-1.5 py-0.5 text-xs text-[var(--site-accent)]"
                                style={{ borderRadius: "var(--site-radius)" }}
                              >
                                {tag}
                              </span>
                            ))}
                            {item.allergens.map((allergen) => (
                              <span
                                key={allergen}
                                className="bg-[var(--site-muted)] px-1.5 py-0.5 text-xs text-[var(--site-muted-foreground)]"
                                style={{ borderRadius: "var(--site-radius)" }}
                              >
                                {allergen}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="font-medium whitespace-nowrap">
                        {item.currency} {item.price}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
