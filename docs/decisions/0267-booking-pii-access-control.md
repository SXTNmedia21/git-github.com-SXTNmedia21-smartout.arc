---
title: "Booking PII Access Control — Field-Level Gate by profile.role"
id: ADR-0267
status: proposed
layer: decision
created: 2026-05-04
updated: 2026-05-04
---

# ADR-0267: Booking PII Access Control

## Context

Phase 1 lovsen-rapport (2026-05-04) flagged FOUR HIGH-severity findings on booking-PII exposure in the calendar redesign:

- **F-01**: `it.contact` (gjeste-navn + telefon, e.g., `'Ingrid Solheim · 99 88 77 66'`) is rendered in `screens.jsx → DetailSheet` (line 503-508) for ALL workspace users without rolesjekk.
- **F-02**: "Ring"-knapp (`screens.jsx:508`) triggers `tel:` against the gjestens telefonnummer for ALL roles.
- **F-03**: GDPR art. 5(1)(f) need-to-know basis is not implemented for booking-PII.
- **F-04** (out-of-scope-for-Phase-3): avvik-push with andres PII would compound the leak.

Lovsen confidence on F-01/F-02/F-03 is **HIGH** — GDPR art. 5(1)(f) is directly applicable. Eksponering kan utgjøre brudd på personopplysningsloven, med meldeplikt etter art. 33 dersom risiko for den registrerte foreligger.

Plan §Phase 3e (sheets + AddFlow) builds DetailSheet with type-specific branching (task / shift / booking). Without rolling field-level access control, the booking branch ships an unguarded PII leak.

## Decision Drivers

- GDPR art. 5(1)(f) — personal data must be treated with confidentiality, "need-to-know" basis.
- GDPR art. 33 — meldeplikt to Datatilsynet when breach risks data subjects (gjest).
- ADR-0078 prinsipp — channel restrictions for PII; same logic applies to surface restrictions for guest-PII.
- Lovsen Q3 verdict: only resepsjonist / manager / admin / owner have a documented need-to-know for guest contact info; vanlig kelner needs bord + antall + spesielle behov, NOT navn + telefon.
- ADR-0133 — mobile is execution surface; "Ring guest" is an execute verb, but only authorized roles execute it.
- L-0177 — silent fallback patterns must fail fast; surface that "looks like contact info exists" must mask cleanly without hidden bypass.

## Considered Options

1. **Mask `contact` to `null` for `employee` role; show "Kontakt resepsjonen" CTA instead of Ring-button.** Chosen.
2. **Server-side filter — strip `contact` field at BFF/Edge function for `employee` role.** Considered. Rejected for V1 — Phase 3 reads Supabase client directly; introducing a BFF route adds an auth surface (per ADR-0151) without delivering more security than option 1 (RLS already gates workspace).
3. **Show contact to all, audit-log access.** Rejected — does not satisfy GDPR art. 5(1)(f) "need-to-know"; audit-after-leak ≠ prevent-leak.
4. **Show partial contact (initials only) to `employee`.** Rejected — partial PII is still PII; "Solheim" alone is identifying in a small workspace.

## Decision Outcome

**Chosen: Option 1 — field-level mask in `useCalendarItems` hook + UI fallback CTA.**

### Implementation contract

**`useCalendarItems({ date, scope, filter })`** (Phase 3c) MUST:

```ts
type CalendarItem = {
  id: string;
  type: 'shift' | 'task' | 'booking' | 'deviation' | 'note';
  date: number;
  title: string;
  time?: string;
  dept: Department;
  status: ItemStatus;
  // shift
  role?: string;
  zone?: string;
  // booking
  guests?: number;
  tables?: string;
  contact?: string | null; // null when masked
  contactRedacted?: boolean; // explicit flag for UI
};
```

Inside the hook, after fetching booking rows:

```ts
const role = profile.role;
const canSeeContact = role === 'manager' || role === 'admin' || role === 'owner';

return bookings.map(b => ({
  ...item,
  contact: canSeeContact ? b.contact : null,
  contactRedacted: !canSeeContact,
}));
```

**`DetailSheet`** (Phase 3e) MUST:

- When `contactRedacted === true`:
  - Hide the contact-row entirely OR show a stub "Kontakt resepsjonen" text — both acceptable per design.
  - Replace the "Ring"-button with a passive "Kontakt resepsjonen" label OR remove the action entirely.
  - Never render `tel:` link, never expose `contact` string, never log `contact` to telemetry.
- When `contactRedacted === false`:
  - Render contact + "Ring"-button per design handoff.
  - Telemetry on tap MUST NOT include the phone number — emit event name only (e.g., `calendar booking_contact_called`).

### Role table

| `profile.role` | `contact` field | "Ring" action | Special-needs / allergens / table | Guest count |
|---|---|---|---|---|
| `employee` | `null` (masked) | Hidden / replaced by "Kontakt resepsjonen" | visible | visible |
| `manager` | full | visible + functional | visible | visible |
| `admin` | full | visible + functional | visible | visible |
| `owner` | full | visible + functional | visible | visible |

**No partial contact for any role.** Either full or null.

### Telemetry contract (ADR-0134)

Booking-related telemetry events MUST NEVER carry `contact` payload:

```ts
emit("calendar booking_opened", { workspace_id, actor_id, item_id, dept });
// NOT: { contact: "Ingrid Solheim · 99 88 77 66" }
```

Even masked `null` should not be emitted — payload is irrelevant for analytics.

### BLOCKING for Phase 3e

ADR-0267 must be `accepted` and `useCalendarItems` field-level access implemented BEFORE the DetailSheet booking branch ships in production.

Phase 3d (shift list redesign) is NOT blocked — booking-PII does not appear in the shift-list views per handoff. Booking surfaces only in DetailSheet (Phase 3e).

## Rules

### R1. `contact` field is field-level access controlled, not scope-controlled

ADR-0266 governs scope-mode access. ADR-0267 governs field access within visible items. Both apply: an `employee` may see a booking item via `scope='all'` (legitimate driftsformål per ADR-0266), but the contact field is masked per ADR-0267.

### R2. UI must never render PII when `contactRedacted === true`

No conditional CSS hide; no hidden HTML attribute. The hook returns `null`; the UI never receives the value.

### R3. Backend canonical guard (deferred)

When wt-3 future-work introduces a BFF route for booking detail (e.g., for a "request contact override" capability), the BFF MUST re-apply the role gate server-side per ADR-0151 — defense-in-depth; client-mask alone insufficient at that point. Until then, RLS + client-mask is sufficient.

### R4. Audit on contact reveal (future capability)

If/when a `contact_reveal_request` capability is added (manager grants employee one-time contact for callback), it MUST emit `gate_evaluation` per ADR-0099 and a `booking.contact.revealed` audit event. Not in Phase 3 scope.

## Consequences

### Positive

- Closes lovsen F-01/F-02/F-03 BLOCKING findings.
- GDPR art. 5(1)(f) need-to-know enforced at hook boundary.
- No new auth surface (RLS + client-mask).
- Telemetry contract preserves PII discipline (ADR-0134 + ADR-0078).

### Negative / Debt

- Client-mask can be bypassed by malicious actor reading raw `schedule_day_booking` rows directly. Mitigation: defense-in-depth via RLS scope; add `view_booking_contact` RLS policy as backlog (only `manager+` roles can SELECT contact column directly via dedicated view). Tracked as ADR-0267 follow-up.
- "Kontakt resepsjonen" is a passive CTA (not a clickable callback). UX may want active "request contact" flow — that's a future capability per R4.

## Cross-references

- **ADR-0078** — channel restrictions for PII (forbid voice for guest-PII)
- **ADR-0099** — gate_action audit (future contact_reveal_request)
- **ADR-0133** — execute verbs on mobile (Ring is execute; gated by role)
- **ADR-0134** — telemetry contract (no PII in payloads)
- **ADR-0151** — server-derived workspace_id (future BFF route)
- **ADR-0266** — vaktliste scope RBAC (orthogonal: scope vs field)
- **L-0177** — fail-fast on missing context (no silent body-supplied fallback)
- **Lovsen F-01/F-02/F-03** — booking-PII findings
- **GDPR** art. 5(1)(b) formålsbegrensning, 5(1)(f) integritet og konfidensialitet, 33 (meldeplikt)

## Eskalering

Lovsen anbefaler å konsultere personvernadvokat eller Datatilsynet (veiledning) FØR booking-detail surface lander i produksjon. Tracked outside this ADR.

## Status

`proposed` — **BLOCKING for Phase 3e DetailSheet booking branch**. Accepts when:

1. `useCalendarItems` field-level mask implemented.
2. DetailSheet booking branch verified to render no PII for `employee` role.
3. Role gate verified across `profile.role` enum (employee / manager / admin / owner).
