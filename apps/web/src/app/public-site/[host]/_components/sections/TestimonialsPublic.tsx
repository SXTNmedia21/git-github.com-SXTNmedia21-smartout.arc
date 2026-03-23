import type { PublicSectionProps } from "./types";

type Testimonial = {
  quote: string;
  name: string;
  role?: string;
};

export function TestimonialsPublic({ content }: PublicSectionProps) {
  const heading = content.heading as string | undefined;
  const testimonials = (content.testimonials as Testimonial[] | undefined) ?? [];

  return (
    <section className="site-bg-muted py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {heading && (
          <h2
            className="mb-10 text-center text-2xl font-bold md:text-3xl"
            style={{ fontFamily: "var(--site-font-heading)" }}
          >
            {heading}
          </h2>
        )}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <blockquote
              key={i}
              className="site-bg-background p-6"
              style={{ borderRadius: "var(--site-radius)", boxShadow: "var(--site-shadow)" }}
            >
              <p className="mb-4 text-[var(--site-muted-foreground)] italic">
                &ldquo;{t.quote}&rdquo;
              </p>
              <footer className="text-sm font-medium">
                <span className="text-[var(--site-foreground)]">{t.name}</span>
                {t.role && (
                  <span className="text-[var(--site-muted-foreground)]"> &mdash; {t.role}</span>
                )}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
