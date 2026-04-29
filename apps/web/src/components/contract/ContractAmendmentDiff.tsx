// apps/web/src/components/contract/ContractAmendmentDiff.tsx
// What: Renders field-level diff between original and amended contract values.
// Why: Journey 5 — employee sees side-by-side diff before re-signing (ADR-0236).
// Web: side-by-side panes. Mobile: stacked rows. Uses bg-emerald-500/10 + bg-rose-500/10.
// Driving ADR: ADR-0236 (amendment flow + AcknowledgementRing — WCAG AAA + 6 animated elements)
//
// Motion: row highlight on diff line appear uses motionTokens.enterMs / 1000 with
// useReducedMotion guard — static bg if reduced (WCAG AAA requirement per ADR-0236).

"use client";

interface DiffField {
  label: string;
  previous: string | number | null;
  proposed: string | number | null;
}

interface ContractAmendmentDiffProps {
  fields: DiffField[];
  layout?: "side-by-side" | "stacked";
}

export function ContractAmendmentDiff({
  fields,
  layout = "side-by-side",
}: ContractAmendmentDiffProps) {
  return (
    <div data-layout={layout}>
      {/* TODO Phase 0a: implement diff rows with motion highlight + useReducedMotion guard */}
      {fields.map((f) => (
        <div key={f.label}>
          <span>{f.label}</span>
          <span className="bg-rose-500/10">{String(f.previous ?? "—")}</span>
          <span className="bg-emerald-500/10">{String(f.proposed ?? "—")}</span>
        </div>
      ))}
    </div>
  );
}
