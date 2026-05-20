---
title: "Slice 09 — ADR Coverage Gaps"
status: complete
created: 2026-05-20
updated: 2026-05-20
run_id: 2026-05-20-adr-contract-validation-02
slice: 09_of_14
tags: [audit, adr, registry, coverage-gaps, enforcement]
---

# Slice 09 — ADR Coverage Gaps

## Summary

| Category | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 4 |
| LOW | 3 |
| INFO | 3 |
| **Total** | **11** |

**Verdict: YELLOW.** Registry hygiene is functional but three enforcement-less accepted ADRs are accumulating violations, and two `proposed` ADRs have code already shipping against their contracts. The ADR-0322 gap from baseline remains undocumented.

---

## Findings

### HIGH

#### F-09-01 — ADR-0322 slot: no file, no log entry, no reserved note (PERSISTS FROM BASELINE)

- **Severity:** HIGH
- **Location:** `docs/decisions/` — gap between `0321-swap-marketplace-convergence.md` and `0323-pre-promote-preview-council-protocol.md`
- **ADR:** registry hygiene
- **Detail:** Slot 0322 has no file, no `0000-decision-log.md` entry, and no "RESERVED" note. All other confirmed gaps are documented: 0092 is marked reserved (`Monitor Mode Graduation Criteria`), 0159 has a log entry (`RESERVED — mid-session renumber 2026-04-19`), 0232 has a log entry (`Renumbered → 0236`). Slot 0322 is the only silent gap.
- **Remediation:** Add a row to `0000-decision-log.md`: `| ADR-0322 | — | RESERVED — slot skipped [reason TBD — confirm from git blame on 0321/0323 commit timestamps] | n/a |`
- **ETA:** < 15 min

---

### MEDIUM

#### F-09-02 — ADR-0366 ESLint rule mandated, not shipped (enforcement-less accepted)

- **Severity:** MEDIUM
- **Location:** `docs/decisions/0366-nordic-split-oklch-literal-ban.md` §Enforcement; `packages/eslint-config/plugins/smartout/`
- **ADR:** 0366
- **Detail:** ADR-0366 (`proposed`) mandates ESLint rule `nordic-split/no-oklch-literal` in `packages/eslint-config/`. No such rule exists — `plugins/smartout/` contains only `no-direct-supabase-write.mjs`, `no-empty-string-identifier-fallback.mjs`, `no-gated-write-in-capabilities.mjs`. Baseline (2026-05-20 Synthesis §ADR conflict table) confirms same finding. Without the lint rule, OKLCH literal violations accumulate silently — Slice 11 found 283 hits before the sweep, helpdesk-orb runtime gradients survive unremediated. Baseline MEMORY.md flags this explicitly: "Same for CLAUDE.md i18n rule — 90% of NO .tsx files have 0 t(). Next defense: ESLint rule for OKLCH literals + i18n hardcoded-string scanner BEFORE next big sweep."
- **Remediation:** Ship `packages/eslint-config/plugins/smartout/rules/no-oklch-literal.mjs` and register it in `plugins/smartout/index.mjs`. Enable in `next.mjs` config. Promote ADR-0366 to `accepted` once rule is wired.
- **ETA:** 1–2 hours

#### F-09-03 — ADR-0377 enforcement script not shipped (enforcement-less proposed)

- **Severity:** MEDIUM
- **Location:** `docs/decisions/0377-telemetry-registry-requires-emit-wiring.md` §Enforcement; `scripts/`
- **ADR:** 0377
- **Detail:** ADR-0377 (`proposed`) mandates `scripts/check-telemetry-emit-coverage.ts` + pre-commit hook + CI gate. Script does not exist — `scripts/` has `check-tool-name-collisions.ts` (ADR-0365, SHIPPED) and `gate-action-coverage.ts` but no telemetry coverage checker. Two HMS events and two ui-shell events (deviation_viewed + handbook_chapter_opened) registered without emit wiring (caught in prior slices); the enforcement mechanism that would have prevented this is absent. Persists from baseline.
- **Remediation:** Ship `scripts/check-telemetry-emit-coverage.ts`, add husky pre-commit entry, add CI step. Promote ADR-0377 to `accepted`.
- **ETA:** 2–3 hours

#### F-09-04 — ADR-0328 enforcement script not shipped (enforcement-less proposed)

- **Severity:** MEDIUM
- **Location:** `docs/decisions/0328-user-friendly-error-messages-with-codes.md`; `infra/scripts/`
- **ADR:** 0328
- **Detail:** ADR-0328 (`proposed`) mandates `infra/scripts/error-catalog-check.sh` as a CI gate for user-visible error messages. Script does not exist — `infra/scripts/` contains deployment scripts (`promote-preview.sh`, `smoke-probe.sh`, `drift-check.sh`) but no error catalog checker. No prior audit slice covers this ADR; newly surfaced.
- **Remediation:** Either ship the script (low complexity — grep error code pattern against catalog) or formally descope enforcement to "author discipline" and document the downgrade with a HANDOFF note in the ADR.
- **ETA:** 1–2 hours

#### F-09-05 — ADR-0135 + ADR-0378 both `proposed`, code fully live in production

- **Severity:** MEDIUM
- **Location:** `docs/decisions/0135-mobile-voice-via-livekit-not-ultravox.md`, `docs/decisions/0378-livekit-data-channel-protocol-botsson.md`; `apps/mobile/src/lib/livekit-data-publish.ts`, `services/voice-agent/src/`
- **ADR:** 0135, 0378
- **Detail:** Both ADRs are `proposed` yet their implementation is in production — four LiveKit topics (botsson-context, botsson-tools-register, botsson-tool-call, botsson-tool-result) fully shipped per mobile-voice-runtime-wire P3+P4. ADR-0378 acknowledges this ("Codifies what P3+P4 shipped — no new code required") but leaves status as `proposed`. ADR-0135 was created 2026-04-17 — over 30 days stale. Code-first drift leaves the contract's authority ambiguous: is it the canonical source or a documentation artifact that could be amended without breaking changes?
- **Remediation:** Promote ADR-0135 and ADR-0378 to `accepted`. No code changes required — status update only.
- **ETA:** < 10 min each

---

### LOW

#### F-09-06 — 13 stale `proposed` ADRs (> 30 days old, no acceptance evidence)

- **Severity:** LOW
- **Location:** `docs/decisions/` — ADRs 0053, 0122, 0123, 0124, 0135, 0136, 0152, 0153, 0154, 0155, 0158, 0270, 0279 (created before 2026-04-20)
- **ADR:** registry hygiene
- **Detail:** 13 of 95 `proposed` ADRs are over 30 days old. Per ADR-0278 (repo governance, itself `proposed`), proposed ADRs with shipping code should be promoted to `accepted`; those with deferred implementation should be marked `deferred`. Notable examples: ADR-0135 (LiveKit mobile, code live since 2026-05-20), ADR-0153 (Expo-web surface classification), ADR-0154 (Unified Overlay System), ADR-0155 (LiveKit calls in Expo-web). These are "zombie proposed" — the decision was taken, the code shipped, but the ADR was never closed.
- **Remediation:** Triage in a single 30-min pass: promote ADRs with shipped code to `accepted`, mark others `deferred` with a rationale comment.
- **ETA:** 30 min

#### F-09-07 — 23 ADRs missing `id:` frontmatter field

- **Severity:** LOW
- **Location:** `docs/decisions/*.md` — early ADRs (0050, 0057, 0068, 0071, 0075 `status:live` corrected as `accepted`, 0089, plus ~18 others) missing the `id:` field
- **ADR:** documentation protocol / CLAUDE.md frontmatter standard
- **Detail:** 23 ADR files are missing the `id:` frontmatter field (required per CLAUDE.md §Mandatory: YAML Frontmatter). 10 are additionally missing `updated:`. These are older ADRs (pre-0100 cluster) where the field was added to the template later. Does not affect decision authority but breaks `id:`-based cross-reference tooling.
- **Remediation:** Batch add `id: ADR_XXXX` + `updated:` fields. Low risk, purely mechanical.
- **ETA:** 15 min scripted

#### F-09-08 — ADR-0075 `status: live` (non-standard)

- **Severity:** LOW
- **Location:** `docs/decisions/0075-knowledge-system-consolidation.md`
- **ADR:** 0075
- **Detail:** ADR-0075 carries `status: live` — not in the canonical set (`proposed | accepted | superseded | deprecated`). The ADR itself is active and enforced (boot sequence, DASHBOARD.md, claude-mem MCP pattern). "Live" was an informal label; should be `accepted`.
- **Remediation:** Change `status: live` → `status: accepted` in frontmatter.
- **ETA:** 1 min

---

### INFO

#### F-09-09 — ADR-0248 amendment format is consistent with existing pattern

- **Severity:** INFO
- **Location:** `docs/decisions/0248-b5-action-handlers-canonical-emit-producer.md` lines 62–110
- **ADR:** 0248
- **Detail:** PR #432 (baseline reference) added the 2026-05-20 amendment. Format: `## Amendment YYYY-MM-DD — <title>` body with `### Context` + `### Amendment ruling` sub-sections; `updated:` frontmatter bumped to 2026-05-20. This matches the established pattern in ADR-0078 (Amendment 2026-05-06) and ADR-0091 (Amendment 2026-04-26). No compliance issue. Status remains `proposed` — which is technically correct given the full ADR (Phase A4b B5 handlers) has not shipped.
- **Note:** The amendment legitimizes the SE-01 HIGH finding from Slice 02, converting it from violation to interim approved deviation. Slice 02 SE-01 remediation should be updated to reference this amendment.

#### F-09-10 — ADR-0092, ADR-0159, ADR-0232 gaps all documented

- **Severity:** INFO
- **Location:** `docs/decisions/0000-decision-log.md`
- **ADR:** registry hygiene
- **Detail:** Three of the four gap slots are properly documented. ADR-0092 has a `reserved` entry (Monitor Mode Graduation Criteria). ADR-0159 has a `RESERVED` entry (mid-session renumber 2026-04-19, L-0084). ADR-0232 has a `Renumbered → 0236` entry. Only ADR-0322 is undocumented (F-09-01 above).

#### F-09-11 — `status: draft` used on three ADRs (0137, 0138, 0139)

- **Severity:** INFO
- **Location:** `docs/decisions/0137-gate-action-stacking-semantics.md`, `0138-agent-tool-result-gate-outcome.md`, `0139-color-proposed-pending-state-ux.md`
- **ADR:** registry hygiene
- **Detail:** Three ADRs use `status: draft` (not in standard set). Created 2026-04-17. All are gate-client wave 2 prerequisites per `0000-decision-log.md` line 512. The `draft` status is informally understood ("not yet ratified") but not in the template. Should be normalized to `proposed` to match the standard lifecycle vocabulary.
- **Remediation:** Change `status: draft` → `status: proposed` on all three files.
- **ETA:** 2 min

---

## Enforcement-less ADR Count

| ADR | Status | Enforcement claimed | Script/Rule exists | Gap |
|---|---|---|---|---|
| 0366 | proposed | ESLint `no-oklch-literal` | NO | **YES — unshipped** |
| 0377 | proposed | `scripts/check-telemetry-emit-coverage.ts` | NO | **YES — unshipped** |
| 0328 | proposed | `infra/scripts/error-catalog-check.sh` | NO | **YES — unshipped** |
| 0365 | proposed | `scripts/check-tool-name-collisions.ts` | YES | closed |

3 enforcement-less ADRs currently open. Pattern from MEMORY.md: "enforcement-less ADRs accumulate violations geometrically." ADR-0366 is the most critical: it has a 30+ file OKLCH violation backlog that survives every sweep without the lint rule.

---

## Per-ADR Status Rollup

| ADR range | Files | Gaps | Reserved/noted | Notes |
|---|---|---|---|---|
| 0001–0091 | 91 | 0 | — | Complete |
| 0092 | 0 | 1 | YES — reserved | Monitor Mode deferred |
| 0093–0158 | 65 | 0 | — | |
| 0159 | 0 | 1 | YES — reserved | Mid-session renumber |
| 0160–0231 | 71 | 0 | — | |
| 0232 | 0 | 1 | YES — renumbered 0236 | |
| 0233–0321 | 89 | 0 | — | |
| 0322 | 0 | 1 | **NO — undocumented** | F-09-01 |
| 0323–0378 | 56 | 0 | — | |
| **Total** | **375 files** | **4 gaps** | **3 of 4 documented** | |

---

## Verified Intentional

- ADR-0321 `superseded` by ADR-0340 — correctly noted in both files and decision log.
- ADR-0357 (dev branch: drop-parallel-access-token, `accepted`) and ADR-0376 (campaign: page-polish-documented-intentional-skips, `proposed`) coexist — outsider-renumber pattern per L-0147, both registered in log. Not a duplicate.
- ADR-0358 (dev: join-expired-session-rescue) and ADR-0377 (campaign: telemetry-emit-wiring) similarly coexist under the same pattern.

---

## In-Progress / Not Yet Audited

- ADR-0278 (Repo Governance Protocol, `proposed`) — references enforcement mechanisms (retention scripts, capability index) none of which have shipped. Scope deferred: ADR-0278 is meta-governance for the repo cleanup pipeline itself; its enforcement-less state is partially intentional (bootstrap problem).
- ADRs 0360–0378 were all registered in `0000-decision-log.md` — no gap in recent range.
