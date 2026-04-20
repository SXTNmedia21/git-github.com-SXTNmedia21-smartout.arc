"use client";

type Props = {
  startX: number;
  currentX: number;
  top: number;
  height: number;
  startDate: string;
  endDate: string;
};

export function DrawPhantom({ startX, currentX, top, height, startDate, endDate }: Props) {
  const left = Math.min(startX, currentX);
  const width = Math.abs(currentX - startX);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute flex items-center justify-center rounded-[10px] font-mono text-xs font-semibold"
      style={{
        left,
        top,
        width,
        height,
        background: "color-mix(in oklab, var(--brand-orange) 18%, transparent)",
        border: "1.5px dashed var(--brand-orange)",
        color: "var(--brand-orange)",
      }}
    >
      <span aria-live="polite" className="sr-only">
        Tegner sesong {startDate} til {endDate}
      </span>
      <span>
        {startDate} → {endDate}
      </span>
    </div>
  );
}
