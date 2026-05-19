/**
 * HolidayBand — holiday name indicator for calendar cells.
 *
 * Two variants:
 *   - "month-cell" — absolute top strip inside a month grid cell.
 *     Rendered above the day number so it doesn't compete for space.
 *   - "week-header" — compact inline chip in week column header.
 *
 * Brand-orange accent, aria-hidden so screen readers skip decorative strip
 * (holiday name is conveyed via accessible day label or nearby context).
 */

type HolidayBandProps = {
  name: string;
  variant: "month-cell" | "week-header";
};

export function HolidayBand({ name, variant }: HolidayBandProps) {
  if (variant === "month-cell") {
    return (
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 truncate px-1.5 py-0.5 text-[8px] font-semibold tracking-wide uppercase"
        style={{
          backgroundColor: "color-mix(in oklch, var(--brand-orange) 20%, transparent)",
          color: "var(--brand-orange)",
          lineHeight: "1.2",
        }}
        title={name}
      >
        {name}
      </div>
    );
  }

  // week-header — inline chip below the day number
  return (
    <div
      aria-hidden
      className="mt-0.5 truncate rounded px-1 py-0.5 text-[8px] font-semibold uppercase"
      style={{
        backgroundColor: "color-mix(in oklch, var(--brand-orange) 20%, transparent)",
        color: "var(--brand-orange)",
        lineHeight: "1.2",
        maxWidth: "100%",
      }}
      title={name}
    >
      {name}
    </div>
  );
}
