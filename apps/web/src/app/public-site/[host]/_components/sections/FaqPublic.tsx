import type { PublicSectionProps } from "./types";

type FaqItem = {
  question: string;
  answer: string;
};

export function FaqPublic({ content }: PublicSectionProps) {
  const heading = content.heading as string | undefined;
  const items = (content.items as FaqItem[] | undefined) ?? [];

  return (
    <section className="py-12 md:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {heading && (
          <h2
            className="mb-8 text-center text-2xl font-bold md:text-3xl"
            style={{ fontFamily: "var(--site-font-heading)" }}
          >
            {heading}
          </h2>
        )}
        <div className="space-y-2">
          {items.map((item, i) => (
            <details
              key={i}
              className="group overflow-hidden border border-[var(--site-muted)]"
              style={{ borderRadius: "var(--site-radius)" }}
            >
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-medium hover:bg-[var(--site-muted)]/50">
                {item.question}
                <span className="ml-2 text-[var(--site-muted-foreground)] transition-transform group-open:rotate-180">
                  &#9662;
                </span>
              </summary>
              <div className="px-5 pb-4 text-sm leading-relaxed text-[var(--site-muted-foreground)]">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
