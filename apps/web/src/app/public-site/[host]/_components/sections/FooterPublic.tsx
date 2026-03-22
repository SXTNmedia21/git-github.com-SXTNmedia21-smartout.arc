import type { PublicSectionProps } from "./types";

/** Page-level footer section (different from the site-wide SiteFooter layout component). */
export function FooterPublic({ content }: PublicSectionProps) {
  const text = content.text as string | undefined;
  const links = (content.links as Array<{ label: string; url: string }> | undefined) ?? [];

  return (
    <section className="bg-[var(--site-muted)] py-8">
      <div className="mx-auto max-w-7xl px-4 text-center text-sm text-[var(--site-muted-foreground)] sm:px-6 lg:px-8">
        {text && <p className="mb-3">{text}</p>}
        {links.length > 0 && (
          <div className="flex flex-wrap justify-center gap-4">
            {links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                className="transition-colors hover:text-[var(--site-primary)]"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
