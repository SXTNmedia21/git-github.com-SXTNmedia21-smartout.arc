import type { PublicSectionProps } from "./types";

type HoursEntry = {
  day: string;
  open: string;
  close: string;
  closed?: boolean;
};

export function HoursPublic({ content }: PublicSectionProps) {
  const heading = content.heading as string | undefined;
  const hours = (content.hours as HoursEntry[] | undefined) ?? [];

  return (
    <section className="py-12 md:py-16">
      <div className="mx-auto max-w-lg px-4 sm:px-6 lg:px-8">
        {heading && (
          <h2
            className="mb-8 text-center text-2xl font-bold md:text-3xl"
            style={{ fontFamily: "var(--site-font-heading)" }}
          >
            {heading}
          </h2>
        )}
        <table className="w-full text-sm">
          <tbody>
            {hours.map((entry, i) => (
              <tr key={i} className="border-b border-[var(--site-muted)]">
                <td className="py-3 font-medium">{entry.day}</td>
                <td className="py-3 text-right text-[var(--site-muted-foreground)]">
                  {entry.closed ? "Stengt" : `${entry.open} – ${entry.close}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
