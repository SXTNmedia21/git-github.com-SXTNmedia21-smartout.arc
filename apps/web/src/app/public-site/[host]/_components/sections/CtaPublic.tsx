import type { PublicSectionProps } from "./types";

export function CtaPublic({ content }: PublicSectionProps) {
  const heading = content.heading as string | undefined;
  const text = content.text as string | undefined;
  const buttonText = content.buttonText as string | undefined;
  const buttonUrl = content.buttonUrl as string | undefined;

  return (
    <section
      className="py-16 text-center md:py-20"
      style={{ backgroundColor: "var(--site-primary)" }}
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {heading && (
          <h2
            className="mb-4 text-2xl font-bold text-white md:text-3xl"
            style={{ fontFamily: "var(--site-font-heading)" }}
          >
            {heading}
          </h2>
        )}
        {text && <p className="mb-8 text-lg text-white/90">{text}</p>}
        {buttonText && buttonUrl && (
          <a
            href={buttonUrl}
            className="inline-block bg-white px-8 py-3 font-medium transition-opacity hover:opacity-90"
            style={{
              color: "var(--site-primary)",
              borderRadius: "var(--site-radius)",
            }}
          >
            {buttonText}
          </a>
        )}
      </div>
    </section>
  );
}
