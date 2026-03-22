import type { PublicSectionProps } from "./types";

export function ContactPublic({ content }: PublicSectionProps) {
  const heading = content.heading as string | undefined;
  const email = content.email as string | undefined;
  const phone = content.phone as string | undefined;
  const address = content.address as string | undefined;
  const text = content.text as string | undefined;

  return (
    <section className="py-12 md:py-16">
      <div className="mx-auto max-w-lg px-4 text-center sm:px-6 lg:px-8">
        {heading && (
          <h2
            className="mb-6 text-2xl font-bold md:text-3xl"
            style={{ fontFamily: "var(--site-font-heading)" }}
          >
            {heading}
          </h2>
        )}
        {text && <p className="mb-6 text-[var(--site-muted-foreground)]">{text}</p>}
        <div className="space-y-3 text-sm">
          {email && (
            <p>
              <a href={`mailto:${email}`} className="hover:text-[var(--site-primary)]">
                {email}
              </a>
            </p>
          )}
          {phone && (
            <p>
              <a href={`tel:${phone}`} className="hover:text-[var(--site-primary)]">
                {phone}
              </a>
            </p>
          )}
          {address && <p className="text-[var(--site-muted-foreground)]">{address}</p>}
        </div>
      </div>
    </section>
  );
}
