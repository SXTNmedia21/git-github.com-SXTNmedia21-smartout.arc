// apps/web/src/components/contract/TariffBadge.tsx
// What: Badge showing tariff sync state per ADR-0181 drift indicator.
// Why: Employee /my-contract page needs to surface whether their tariff is current.
// States: green (synced), amber (>7 days), red (>30 days stale).
// Phase 0a ships badge + tooltip. Phase 0b adds clickable EntityDrawer destination.
// Driving ADRs: ADR-0181 (tariff sync drift indicator), ADR-0236 (WCAG AAA + motion)
//
// Motion: amber/red pulse on stale state uses motionTokens.springGentle with
// useReducedMotion guard — static badge if reduced (WCAG AAA requirement per ADR-0236).

"use client";

type TariffSyncState = "synced" | "pending" | "stale";

interface TariffBadgeProps {
  state: TariffSyncState;
  lastSyncedAt: string | null;
  tariffName: string;
}

export function TariffBadge({
  state,
  lastSyncedAt,
  tariffName,
}: TariffBadgeProps) {
  return (
    <span data-state={state} title={lastSyncedAt ?? undefined}>
      {/* TODO Phase 0a: implement badge with pulse animation + useReducedMotion guard */}
      {tariffName}
    </span>
  );
}
