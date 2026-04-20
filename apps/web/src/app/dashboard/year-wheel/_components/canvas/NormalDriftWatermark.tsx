// Watermark lives behind blocks. Light-mode: 6% mix. Dark-mode: 10% mix (per spec §3.4.1 override).
export function NormalDriftWatermark({ centerY }: { centerY: number }) {
  return (
    <>
      <div
        aria-hidden
        className="yw-watermark-hatch pointer-events-none absolute inset-0"
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 80px, #000 100%)",
          maskImage: "linear-gradient(to bottom, transparent 0, #000 80px, #000 100%)",
        }}
      />
      <div
        aria-hidden
        className="font-heading text-muted-foreground/40 pointer-events-none absolute left-1/2 -translate-x-1/2 text-[22px] tracking-[0.12em] uppercase italic"
        style={{ top: centerY - 12 }}
      >
        Normal drift
      </div>
    </>
  );
}
