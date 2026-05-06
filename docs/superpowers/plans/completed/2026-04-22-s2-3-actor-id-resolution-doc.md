---
title: "S2.3 Sub-Sortie Brief — actor_id resolution doc (ADR-0176 appendix)"
status: approved
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [sub-sortie, m2, adr-0176, actor-id, docs]
---

# S2.3 — `actor_id` resolution doc (ADR-0176 appendix)

> **Campaign:** journey-engine · **Milestone:** M2 · **Sub-sortie:** S2.3
> **Trust-Gate Unblock closed:** #6 (actor_id resolution doc).
> **Binding ADRs:** 0176 (authority seed — extended by this appendix), 0134 (mobile telemetry contract), 0132 (mobile thin-client via BFF).
> **Gate B council:** Conditional-Go — BFF server-side derivation note required (CVE-class oversight risk).

---

## Why this matters

The 5 journey events in `packages/telemetry/src/registry.ts` all require `actor_id` in the payload. The 4 journey capabilities in `packages/ai/src/capabilities/journey/tools.ts` all guard on `ctx.profileId` being non-null before emit (ADR-0134). But the rules for HOW `actor_id` is resolved differ per surface — and those rules have never been written down. Without them, a future M5 subagent implementing the BFF route for `journey.run_guided` has no contract to constrain it, and can fall into the L-0097 trap a third time by trusting a client-supplied value.

## Scope — exactly what lands

**Zero code.** One appendix to one existing ADR. No new files.

### File to modify

`docs/decisions/0176-journey-c4-authority-seed.md`

### Insertion point

Append a new section `## Appendix: actor_id Resolution per Surface` at the end of the file. Per Gate B code-explorer finding: the ADR currently ends with "Rules & Consequences" at line ~44. Add the appendix after that block. Update the `updated:` frontmatter to `2026-04-22`.

### Appendix content (required structure)

The appendix MUST contain the following subsections in this order:

#### 1. Resolution table — all 4 surfaces

| Surface | Capability | Authenticating principal | Resolution mechanism | ADR |
|---|---|---|---|---|
| Dev | `journey.run_dev` | Developer user session (web) | `supabase.auth.getUser()` → `profile` table lookup via `user.id` | ADR-0134 |
| Publish (admin) | `journey.publish_mission`, `journey.publish_guide` | Admin user session (web platform-admin) | Same as Dev — Server Action reads session cookie, joins `profile` | ADR-0134 |
| Runtime web | `journey.run_guided` (web) | Authenticated end-user session | Stage engine resolves profile from session cookie; passes `ctx.profileId` to capability | ADR-0132 |
| Runtime mobile | `journey.run_guided` (mobile) | Mobile end-user session (Supabase Auth) | `getProfileContext()` at `apps/mobile/src/lib/profile-context.ts` — calls `supabase.auth.getUser()` server-side to validate JWT, then `profile` table lookup | ADR-0134 |

#### 2. Invariants (required verbatim)

> **Invariant 1 — Never-null pre-emit.** Every `execute()` in `packages/ai/src/capabilities/journey/tools.ts` MUST return `{ok: false, error: "missing_context"}` if `ctx.workspaceId` or `ctx.profileId` is empty or null, BEFORE any `emit()` side-effect. Enforced by the Gate A C-3 compliance test in `packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts`.
>
> **Invariant 2 — Empty-string fallback forbidden.** `actor_id: profileId ?? ""` is banned. Enforced by Gate A C-5 grep gate: `grep -R "actor_id:.*?? \"\"" packages/ai/src/capabilities/journey/` returns 0 lines.
>
> **Invariant 3 — Server-side derivation on BFF routes (CVE-class).** The `journey.run_guided` BFF route for mobile (to be implemented in M5) MUST derive `actor_id` from the server-authenticated session (`supabase.auth.getUser()` on the server), NEVER from a client-supplied payload field. A malicious client can craft arbitrary JSON; only a server-validated JWT is trustworthy. This mirrors ADR-0134's mandate and extends it: BFF routes are the single server-side trust boundary for mobile journey runs.

#### 3. Surface-specific notes

Three short paragraphs, one per class:

- **Dev + Publish (web platform-admin):** these surfaces run inside Next.js Server Actions with the admin's session cookie. Resolution is trivial — the session cookie is verified by Supabase middleware and the `profile` join produces `profile_id` + `workspace_id`. No separate context hook needed.
- **Runtime web (`journey.run_guided` in-browser):** the stage-engine (`services/stage-engine/`) already resolves session → profile during stage bootstrap. The capability receives a non-null `ctx.profileId` as a function parameter. No new resolution code needed; the guard in `tools.ts` is defense-in-depth.
- **Runtime mobile (`journey.run_guided` via BFF):** mobile client calls `getProfileContext()` to prepare local telemetry payloads. BUT the BFF route at `/api/journey/guided/...` MUST ignore client-supplied `actor_id`/`workspace_id` and re-derive from the request's session (Supabase server-side auth check). Any payload field the client sends is advisory only. The M5 sub-sortie that implements the BFF route is responsible for this re-derivation.

#### 4. Cross-references

Explicit cross-refs (required) to:
- ADR-0134 `docs/decisions/0134-mobile-telemetry-contract.md` — empty-string fallback prohibition and `getProfileContext()` contract.
- ADR-0132 `docs/decisions/0132-mobile-ai-routing.md` — BFF proxy pattern for mobile capability calls.
- ADR-0078 `docs/decisions/0078-*` — voice channel restrictions (separately enforced; noted here because `journey.run_guided` is chat-only per its `allowedChannels: ["chat"]` setting).

## Out of scope

- **DO NOT** modify the main body of ADR-0176 (the seed migration spec). The appendix is additive.
- **DO NOT** edit ADR-0134 or ADR-0132 — only cross-reference them.
- **DO NOT** implement the BFF route. That's M5. This sub-sortie writes the contract the M5 sub-sortie will implement against.
- **DO NOT** write test code. Docs-only.
- **DO NOT** touch `getProfileContext()` implementation or `apps/mobile/src/lib/profile-context.ts`.
- **DO NOT** add actor_id resolution for capabilities outside journey (e.g., helpdesk_query, operations). Scope is journey-only.

## Acceptance criteria (exit gates)

- [ ] `docs/decisions/0176-journey-c4-authority-seed.md` has a new `## Appendix: actor_id Resolution per Surface` section at the end.
- [ ] Appendix contains the 4-row resolution table with columns Surface / Capability / Authenticating principal / Resolution mechanism / ADR.
- [ ] Appendix contains the three invariants verbatim (never-null pre-emit / empty-string fallback forbidden / server-side derivation on BFF routes).
- [ ] Appendix contains cross-refs to ADR-0134, ADR-0132, ADR-0078.
- [ ] Frontmatter `updated:` bumped to `2026-04-22`.
- [ ] `pnpm turbo typecheck` passes (docs-only, should be unaffected).
- [ ] Decision log entry: "ADR-0176 appendix landed — actor_id resolution rules for 4 surfaces documented. BFF server-side derivation invariant added per Gate B council (CVE-class oversight closure). Trust-Gate Unblock #6 closed."
- [ ] Handoff at `docs/HANDOFF-journey-s2-3-actor-id-resolution-doc.md` summarizing the appendix content and citing Gate B's CVE-oversight reasoning.
- [ ] User journey doc at `docs/journeys/JOURNEY-journey-s2-3-actor-id-resolution-doc.md`: admin reads the appendix before implementing BFF route in M5 and knows to re-derive actor_id server-side.

## Dispatch

Single build subagent. Pure doc work; no code, no tests, no migrations. Runs in parallel with S2.1 and S2.4. Return handoff.
