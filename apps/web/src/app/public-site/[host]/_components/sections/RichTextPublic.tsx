import type { PublicSectionProps } from "./types";

export function RichTextPublic({ content }: PublicSectionProps) {
  const paragraphs = content.paragraphs as string[] | undefined;
  const heading = content.heading as string | undefined;

  return (
    <section className="py-12 md:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {heading && (
          <h2
            className="mb-6 text-2xl font-bold md:text-3xl"
            style={{ fontFamily: "var(--site-font-heading)" }}
          >
            {heading}
          </h2>
        )}
        {paragraphs?.map((text, i) => (
          <p key={i} className="mb-4 leading-relaxed text-[var(--site-muted-foreground)]">
            {text}
          </p>
        ))}
      </div>
    </section>
  );
}
