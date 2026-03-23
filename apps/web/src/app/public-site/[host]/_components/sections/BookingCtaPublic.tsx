import type { PublicSectionProps } from "./types";

export function BookingCtaPublic({ content }: PublicSectionProps) {
  const heading = content.heading as string | undefined;
  const text = content.text as string | undefined;
  const buttonText = (content.buttonText as string) ?? "Bestill bord";
  const bookingUrl = content.bookingUrl as string | undefined;

  if (!bookingUrl) return null;

  return (
    <section className="site-bg-muted py-12 md:py-16">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        {heading && (
          <h2
            className="mb-4 text-2xl font-bold md:text-3xl"
            style={{ fontFamily: "var(--site-font-heading)" }}
          >
            {heading}
          </h2>
        )}
        {text && <p className="mb-8 text-[var(--site-muted-foreground)]">{text}</p>}
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-8 py-3 text-lg font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--site-primary)", borderRadius: "var(--site-radius)" }}
        >
          {buttonText}
        </a>
      </div>
    </section>
  );
}
