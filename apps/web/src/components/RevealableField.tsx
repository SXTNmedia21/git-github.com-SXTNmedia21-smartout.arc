// apps/web/src/components/RevealableField.tsx
// What: Renders Høy-PII field values masked by default; click-to-reveal for 5s then auto-masks.
// Why: ADR-0234 §Høy-PII — personal_number, bank_account, tax_* require masking + audit emit.
// Reusable across contract and payroll surfaces — not contract-only.
// Reveal emits payroll.pii_revealed to activity_trail. Auto-masks after 5000ms.
// Driving ADR: ADR-0234 (payroll capability split — PII handling + RevealableField requirement)
//
// Motion: opacity crossfade between masked/revealed states uses motionTokens.exitMs / 1000
// with useReducedMotion guard — instant swap if reduced (WCAG AAA requirement per ADR-0236).

"use client";

interface RevealableFieldProps {
  label: string;
  value: string;
  fieldName: string;
  profileId: string;
  workspaceId: string;
}

export function RevealableField({
  label,
  value,
  fieldName,
  profileId,
  workspaceId,
}: RevealableFieldProps) {
  // Suppress unused-var warnings for Phase 0a scaffold — used in Phase 0a impl
  void value;
  void fieldName;
  void profileId;
  void workspaceId;

  return (
    <div>
      {/* TODO Phase 0a: implement reveal state + 5s timer + emit + useReducedMotion crossfade */}
      <span>{label}</span>
      <span aria-label={`${label} — skjult`}>{"••••••••"}</span>
    </div>
  );
}
