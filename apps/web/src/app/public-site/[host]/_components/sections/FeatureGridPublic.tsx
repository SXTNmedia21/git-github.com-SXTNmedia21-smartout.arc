import type { PublicSectionProps } from "./types";

type FeatureItem = {
  icon?: string;
  title: string;
  description: string;
};

export function FeatureGridPublic({ content }: PublicSectionProps) {
  const heading = content.heading as string | undefined;
  const features = (content.features as FeatureItem[] | undefined) ?? [];

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
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={i}
              className="bg-[var(--site-muted)] p-6 transition-shadow hover:shadow-md"
              style={{ borderRadius: "var(--site-radius)", boxShadow: "var(--site-shadow)" }}
            >
              {feature.icon && <span className="mb-3 block text-3xl">{feature.icon}</span>}
              <h3
                className="mb-2 text-lg font-semibold"
                style={{ fontFamily: "var(--site-font-heading)" }}
              >
                {feature.title}
              </h3>
              <p className="text-sm text-[var(--site-muted-foreground)]">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
