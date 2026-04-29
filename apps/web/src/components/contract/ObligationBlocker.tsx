// apps/web/src/components/contract/ObligationBlocker.tsx
// What: Renders a blocker when employee has overdue contract obligations.
// Why: Journey 4 — clock-in blocked; renders in 3 contexts per §UI ObligationBlocker.
// Variants: "banner" (web), "sheet" (mobile), "botsson-card" (Botsson chat card).
// Driving ADRs: ADR-0235 (obligation lifecycle trigger semantics), ADR-0236 (WCAG AAA + motion)
//
// All variants:
//   - Show obligation name, due date, overdue delta
//   - CTA: deep-link to /dashboard/competence/protocol/[id]
//   - Emit contract.obligation_blocker_shown on mount
//   - Respect useReducedMotion — no entrance animation when reduced

"use client";

interface ObligationBlockerProps {
  variant: "banner" | "sheet" | "botsson-card";
  obligationName: string;
  dueDate: string;
  protocolId: string;
  workspaceSlug: string;
}

export function MobileObligationBlocker(props: ObligationBlockerProps) {
  return (
    <ObligationBlocker {...props} variant="sheet" />
  );
}

export function WebObligationBlocker(props: Omit<ObligationBlockerProps, "variant">) {
  return (
    <ObligationBlocker {...props} variant="banner" />
  );
}

export function BotssonObligationBlockerCard(props: Omit<ObligationBlockerProps, "variant">) {
  return (
    <ObligationBlocker {...props} variant="botsson-card" />
  );
}

export function ObligationBlocker({
  variant,
  obligationName,
  dueDate,
  protocolId,
  workspaceSlug,
}: ObligationBlockerProps) {
  const href = `/${workspaceSlug}/dashboard/competence/protocol/${protocolId}`;

  return (
    <div data-variant={variant}>
      {/* TODO Phase 0a: implement variant rendering + useReducedMotion guard + emit */}
      <span>{obligationName}</span>
      <span>{dueDate}</span>
      <a href={href}>Fullfør nå</a>
    </div>
  );
}
