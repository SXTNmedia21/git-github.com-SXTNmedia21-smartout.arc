---
title: "Dual-gate pattern for reconciliation wizard override — BFF + Server Action each need their own capability"
id: ADR_0205
status: proposed
layer: decision
created: 2026-04-24
updated: 2026-04-24
module: reconciliation
tags: [adr, authority, c4, gate-action, defense-in-depth, reconciliation, mobile, bff]
---

# ADR-0205: Dual-gate pattern for reconciliation wizard override — BFF + Server Action each need their own capability

## Context and Problem Statement

PR #241 (closure sortie) shipped a BFF route `/api/reconciliation/wizard-override` that gates on a NEW capability `signoff.admin_override` (seeded in `supabase/migrations/20260517120000_closure_authority_seed_override.sql`). The existing web Server Action `apps/web/src/app/dashboard/reconciliation/_actions/override-wizard-blocker-action.ts` already gated on `reconciliation.wizard_submit_with_blocker` (seeded in `supabase/migrations/20260516100000_seed_reconciliation_authority.sql`).

Both capabilities protect the **same logical DB mutation** (flip `daily_reconciliation.status` from a blocker state to `'submitted'` with override notes). The 2026-04-23 Council supervisor review flagged the overlap: reviewers reading the code cold could mistake the pair for accidental redundancy and "deduplicate" one away. Neither the route nor the Server Action documents why both rows exist in `engine_authority_config`.

Without a written rule, a future PR WILL collapse the pair — closing the authoring path (web Server Action) or the runtime path (mobile BFF) to satisfy a linter, ESLint rule, or an "unused capability" audit.

## Decision Drivers

- **Two callers, two identity derivations.** The Server Action reads `profile_id` from the Next.js session cookie. The BFF route additionally accepts a Bearer token (mobile via ADR-0132) and re-derives identity server-side per ADR-0176 Invariant 3. Collapsing the gates forces one call path to adopt the other's auth model — both are narrower than "accept either".
- **Defense-in-depth, not redundancy.** If either seed row is accidentally deleted, misconfigured, or flipped to `deny`, the OTHER path still gates the mutation. A single-capability model makes the seed a single point of failure for a CVE-class surface (reconciliation override is an audit-critical admin action).
- **Audit-trail legibility.** `activity_trail` rows from BFF vs Server Action carry different `capability` strings. `signoff.admin_override` events always came from the BFF (web dialog OR mobile sheet); `reconciliation.wizard_submit_with_blocker` events always came from the web Server Action. Merging the names merges the audit signal.
- **ADR-0189 seed-parity invariant.** Parity is enforced at CI per call site, not per logical action. Both call sites exist — both must seed.
- **ADR-0132 mobile routing.** Mobile MUST traverse a BFF; it may not import a Server Action. A mobile-capable capability ( `signoff.admin_override`) must gate at the BFF regardless of what the web authoring path gates on.

## Considered Options

1. **Collapse to one capability (drop `signoff.admin_override`).** The BFF would reuse `reconciliation.wizard_submit_with_blocker`. Rejected — erases the BFF/authoring audit distinction, and the mobile surface loses an independent admin-override rollback lever.
2. **Collapse to one capability (drop `reconciliation.wizard_submit_with_blocker`).** The Server Action would call into the BFF. Rejected — forces a server-to-server HTTP hop for the web dialog with no benefit, and inverts ADR-0133 ("web composes, mobile executes") by making the web path execute through the mobile path's gateway.
3. **Keep both capabilities; document the rule.** CHOSEN. Each call path gates on its own capability. Both seeds live in migrations. Inline comments on both call sites reference this ADR.
4. **Introduce a parent capability that dispatches to children.** Rejected — adds a governance layer (who owns the parent?) and solves a problem (dedup) we don't have; the pair is explicitly not redundant.

## Decision Outcome

Chosen option: **Option 3 — Keep both capabilities. Document the rule.**

### The rule

| Path | Capability | Identity derived via | Caller surface | Channel |
| --- | --- | --- | --- | --- |
| BFF `/api/reconciliation/wizard-override` | `signoff.admin_override` | Bearer token (mobile) OR cookie (web fallback) → admin-client `profile` lookup | `runtime_mobile` or `runtime_web` | `chat` (ADR-0078) |
| Server Action `override-wizard-blocker-action.ts` | `reconciliation.wizard_submit_with_blocker` | Next.js session cookie → server-component user | web authoring | `chat` (ADR-0078) |

Both gates fire `gate_action` with `channel: "chat"` (voice forbidden for critical data per ADR-0078). Both paths persist via `admin-client` after the gate returns `allow=true`. Both emit to `activity_trail` with the gate's own capability string — this is the audit-trail distinguishing feature.

### Invariants (merge-blockers)

1. A PR that removes either seed row without removing its call site fails `scripts/authority-seed-parity.ts` (ADR-0189).
2. A PR that collapses the two capabilities into one must reference this ADR in the description AND cite a new ADR superseding it.
3. Both call sites MUST carry a comment pointing at this ADR (present in `wizard-override/route.ts` Authority gates block; to be added to `override-wizard-blocker-action.ts` in the next Task-P follow-up commit if missing).

## Rules & Consequences

- **Good, because** the audit trail can answer "which surface triggered this override?" from the capability column alone — no join to `engine_event` or log parsing.
- **Good, because** defense-in-depth: a flipped seed on one row does not silently unlock the other path. The CVE-class default-allow window (ADR-0189) is halved.
- **Good, because** the BFF can extend its gate ( `signoff.admin_override`) later with four-eyes or higher min_role without touching the web Server Action's policy — the two gates evolve independently.
- **Bad, because** two `engine_authority_config` rows must stay aligned. Mitigation: both seeded at migration time (ADR-0176), both covered by the ADR-0189 parity check, both required for their call sites.
- **Bad, because** a reviewer reading only one file still sees only one gate; the "why two?" answer lives in this ADR. Mitigation: inline comments point at this file.
- **Agent impact:** when adding a NEW call path (e.g. an Edge Function override) for this same mutation, mint a NEW capability for that path rather than reusing one of these two. The dual-gate pattern generalizes to N paths, not 1.

## References

- **ADR-0132** — Mobile AI Routing (BFF path mandatory for mobile).
- **ADR-0151** — Gate-action singleton + mandatory gating on mutation capability tools.
- **ADR-0176** — Actor ID resolution (server-side BFF re-derivation is the CVE-class red line).
- **ADR-0187** — Single-emit-source discipline for state changes (audit-trail legibility principle).
- **ADR-0189** — Authority seed parity CI check (enforces both seed rows exist per call site).
- **ADR-0078** — Voice policy (`channel="chat"` hard-pin on critical data).
- **ADR-0133** — Web composes, mobile executes.
- **PR #241** — closure sortie that introduced `signoff.admin_override` and surfaced the overlap.
- Call sites:
  - `apps/web/src/app/api/reconciliation/wizard-override/route.ts` (BFF → `signoff.admin_override`).
  - `apps/web/src/app/dashboard/reconciliation/_actions/override-wizard-blocker-action.ts` (Server Action → `reconciliation.wizard_submit_with_blocker`).
- Seed migrations:
  - `supabase/migrations/20260517120000_closure_authority_seed_override.sql`.
  - `supabase/migrations/20260516100000_seed_reconciliation_authority.sql`.

---

> After acceptance: register in `docs/decisions/0000-decision-log.md` (done in same commit) and add the inline comment to `override-wizard-blocker-action.ts` if missing.
