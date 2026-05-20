---
title: "Journey — Admin signs pending employer contracts"
status: verified
feature: contracts-polish
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [journey, ui-shell, contracts, polish, campaign-ui-shell]
---

# Journey — Admin signs pending employer contracts

> Sub-sortie: `ui-shell-contracts-polish`. Journey covering `/dashboard/contracts/awaiting-my-signature`.

## Journey: Admin processes the pending-signature queue

**Precondition:** Admin signed in, on dashboard shell. At least one `contract` row exists with `contract_type=employee`, `sender_email` matching admin's auth email, status not in (`signed`, `cancelled`, `declined`), and `signed_by_employer_at IS NULL`. Admin reached this route via sidebar "Venter på min signatur" link under "Administrasjon > Kontrakter".

1. Admin clicks "Venter på min signatur" in sidebar → browser navigates to `/dashboard/contracts/awaiting-my-signature`
2. Route is a Server Component — `loading.tsx` renders a Nordic Split skeleton (`bg-muted` pulse) while SSR data fetch executes; no layout shift when data resolves
3. Page header renders: Instrument Serif h1 "Avtaler som venter din signatur", dynamic subtitle showing count ("2 kontrakter krever din signatur som arbeidsgiver"), and page instructions: "Disse kontraktene er sendt til ansatte og venter nå på din signatur som arbeidsgiver. Trykk «Signer nå» for å signere elektronisk via DocuSeal. Kontrakten er gyldig først når begge parter har signert."
4. Contract list renders as Cards — each card shows:
   - Contract title (fallback: "Ansattkontrakt") as `text-foreground font-medium`
   - Employee display name + position title + "Sendt {dato}" in muted text
   - `EmployeeSignedBadge`: "Ansatt ikke signert" (outline badge, muted) or "Ansatt signerte {dato}" (outline badge, `text-success-foreground`) depending on `signed_by_employee_at`
   - "Signer nå" primary Button linking to `/sign/<signing_url>` (DocuSeal embed)
   - If `signing_url` is null → disabled "Mangler signeringslenke" Button
5. Supabase auth guard: if `user?.email` is null → immediate redirect to `/login`
6. Client-side filter applied after query: keeps only rows where `employment_contract.signed_by_employer_at == null` (PostgREST nested `.is()` on joined tables is unreliable — safe JS fallback)
7. `AwaitingSignatureToolsBridge` mounts with `contracts` array and `pendingCount` — Botsson tools registered: admin can ask "hvem venter på kontraktsignering?" and get the full pending list
8. Empty state — when zero pending contracts: `Inbox` icon + "Ingen kontrakter venter din signatur" + muted explanation

**Postcondition:** Admin sees a production-grade signing queue. All pending contracts are listed with correct employee signature status. "Signer nå" links are live for contracts with a valid `signing_url`. Botsson tool kit is discoverable and returns accurate pending count. No telemetry emitted on this page (read-only server surface; mutations happen in DocuSeal).

**Error paths:**
- User not authenticated or email null → `redirect("/login")` before any data fetch
- Supabase query fails → `raw` is null, `contracts` array is empty, EmptyState renders (no error thrown)
- Contract has `signing_url=null` → "Mangler signeringslenke" disabled button — no 404 navigation
- `error.tsx` boundary catches unhandled server component throw — renders Norwegian error message with retry
- RLS denies rows for non-sender email → query returns empty; EmptyState renders correctly (no data leak)

## Verification

- `pnpm --filter web typecheck` → 0 errors
- `grep "bg-muted\|bg-background\|border-border\|text-foreground\|text-muted-foreground" apps/web/src/app/dashboard/contracts/awaiting-my-signature/page.tsx` → multiple hits, 0 zinc/gray/slate hardcodes
- `grep "redirect" apps/web/src/app/dashboard/contracts/awaiting-my-signature/page.tsx` → 1 hit (auth guard)
- `grep "signed_by_employer_at" apps/web/src/app/dashboard/contracts/awaiting-my-signature/page.tsx` → 2 hits (query + client-side filter)
- Dev server `/dashboard/contracts/awaiting-my-signature` → loads within 1s, no console errors, correct empty state when queue is empty

## E2E (recommended)

S12 protocol already verifies route returns < 500 — sufficient for orphan-coverage. Per-journey Playwright spec deferred (not in M2 scope; covered by `apps/e2e/protocols/p-sidebar-orphan-coverage.ts` step 5).
