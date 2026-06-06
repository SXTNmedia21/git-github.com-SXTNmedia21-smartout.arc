---
title: "Council Session — PLAN-3 Review (ADR-0430 Phase b)"
type: council-log
created: 2026-05-28
updated: 2026-05-28
topic: PLAN-3-write-rewrite-and-G4-closure
verdict: APPROVE-WITH-9-AMENDMENTS
amendments: [MF-A, MF-B, MF-C, MF-D, MF-E, MF-F, MF-G, MF-H, MF-J]
plan_file: plans/PLAN-3-write-rewrite-and-G4-closure.md
---

# Council Session — PLAN-3 Review

**Topic:** PLAN-3 (WRITE-rewrite + G4 closure + Pattern B audit symmetry + Rule 7 forgery defense + 3 emit-site extensions)
**Session date:** 2026-05-28
**SDSM phase:** Phase 3 (three-axis review) → Phase 5 (chair synthesis)
**Final verdict:** APPROVE-WITH-9-AMENDMENTS
**Applied to spec:** Yes — all 9 amendments applied in single doc-only commit.

---

## Phase 3 Reviewer Verdicts

### Steward (system correctness + ADR fidelity)

The Steward approved the general G4 closure approach and Rule 7 forgery defense structure but raised two blocking concerns. First, §3.6 as originally written implied the `gate_action` RPC would read `channel_constraint` — an inaccurate claim. The `gate_action` function at `supabase/migrations/20260516130000` reads only `level`, `min_role`, and `requires_four_eyes`; `channel_constraint` is present in the seed row but the PL/pgSQL body does not consume it. This is the L-0083 authority-seed-inert pattern recurring. Second, the `SchedulerProposalAccepted` event shape was under-specified — `zone_ids?: string[]` at bundle level loses per-shift provenance and breaks ADR-0309 audit reconstruction. The Steward insisted on `zone_assignments: Array<{shift_id: string; zone_ids: string[]}>` keyed by shift. Both concerns escalated as mandatory conditions.

### Supervisor (sequencing + parallel-agent collision risk)

The Supervisor's focus was on atomicity and split-commit risk. The original spec acknowledged the "all-or-nothing vs compensating rollback" open question in a risk row without resolving it. For a security-critical plan this is insufficient — the supervisor required explicit compensating rollback semantics documented as ACs (not just risk mitigations) so sub-dispatch cannot hand-wave it. Separately, the supervisor flagged that two same-commit requirements (L-0176 telemetry, ADR-0112 type contract for SchedShiftPayload) were stated as "spirit" guidance rather than hard gates — implementer could split commits and typecheck would still pass in isolation. Both upgraded to falsifiable ACs with "split-commit = MF, reject" language. The supervisor also required the pre-flight `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED` flag check to be a blocking gate, not a note.

### Coordinator (cross-namespace boundary + mobile surface)

The Coordinator caught the most structurally incorrect claim in the original spec: §3.5 described extending `emit()` at `apps/web/src/app/api/mobile/shifts/route.ts`. This is wrong — the BFF is a delegation route. The emit happens inside `addShiftAction`, which the BFF calls. Adding a second `emit()` at the BFF layer would double-count the event across all four telemetry destinations (PostHog, Logger, activity_trail, engine_event). The fix is simple — extend `addShiftAction`'s Zod input to accept `zone_ids?` and have the BFF pass `[]` — but the original language would have sent a sub-agent down the wrong path. The Coordinator also flagged MF-G: line refs `:288-313` were stale post-PLAN-1 (the PLAN-1 `departmentId!` assertion and null guard added 11 lines, shifting the block to `:299-326`). Sub-dispatch cannot edit the correct line range without this correction.

---

## Phase 5 Chair Synthesis

The three reviewers converged on nine non-overlapping amendments with no conflicts between them. The chair classified each:

- **Structural corrections (must fix before dispatch):** MF-A (Rule 9 claim accuracy), MF-F (BFF delegation not emit-site), MF-G (stale line refs)
- **Security hardening (explicit ACs required):** MF-B (compensating rollback), MF-H (null-check fail-fast, L-0177 sibling), MF-J (pre-flight flag gate)
- **Telemetry shape precision:** MF-E (zone_assignments array, not flat zone_ids — audit reconstruction requirement)
- **Same-commit gate hardening:** MF-C (L-0176 four emit-sites + three interfaces), MF-D (SchedShiftPayload Zod migration, ADR-0112 sibling)

No amendment conflicts with another. The G4 closure approach, Rule 7 forgery defense structure, Pattern B audit symmetry (AC-3.5 vs AC-3.6 paired contrast), ADR-0112 intent-enum non-requirement, and the core telemetry extension strategy (Option β — extend existing events) were all confirmed without modification.

Chair noted: the L-0083 / MF-A finding is the third recurrence of the authority-seed-inert pattern (previous: `welcome-mission inquiry`, `outreach` intent). Recommend the next council session reviewing any capability with `channel_constraint` seeds explicitly check the `gate_action` PL/pgSQL body against the same question.

---

## Final Verdict

**APPROVE-WITH-9-AMENDMENTS.** No blocking issues remain after amendments applied. PLAN-3 is dispatch-ready.

---

## 9 Amendments Table

| ID | Category | Original claim / gap | Correction |
|----|----------|---------------------|------------|
| MF-A | Structural correction | §3.6 implied gate_action RPC reads channel_constraint | Rule 9 enforcement DEFERRED; 3-layer defense (Zod enum + ADR-0078 + forensic seed). New ACs 3.6.1 + 3.6.2. |
| MF-B | Security hardening | Atomicity risk acknowledged but compensating rollback left as open question | Explicit compensating rollback required in execute callback for all 3 mutation paths. Documented as AC-3.7.1. Atomic RPC deferred to PLAN-N per ADR-0427. |
| MF-C | Same-commit gate | L-0176 "spirit" guidance — 4 emit-sites + 3 interfaces | Upgraded to hard AC-3.10.1: `git diff --stat HEAD^` must show all 7 paths. Split-commit = MF, reject. |
| MF-D | Same-commit gate | SchedShiftPayload Zod migration not gated | AC-3.2.1: `zone` → `zone_ids` migration MUST land same commit as tools.ts consumer. ADR-0112 type contract sibling. |
| MF-E | Telemetry shape | `zone_ids?: string[]` flat on SchedulerProposalAccepted | Shape replaced with `zone_assignments?: Array<{shift_id: string; zone_ids: string[]}>`. Per-shift keying required for ADR-0309 audit reconstruction. AC-3.4.3 added. |
| MF-F | Structural correction | §3.5 described emit() extension at BFF route | BFF is delegation-only; emit in addShiftAction. BFF passes `zone_ids: []`. NO second emit(). AC-3.9 updated. |
| MF-G | Structural correction | Line refs `:288-313` stale post-PLAN-1 (+11 drift) | Updated to `:299-326` throughout. Sub-dispatch instructed to re-grep before editing. |
| MF-H | Security hardening | Rule 7 null-check behavior left implicit | AC-3.3.1: explicit fail-fast required for both DB lookups. NO silent fallback, NO skip-on-null. L-0177 sibling. |
| MF-J | Security hardening | Pre-flight flag check mentioned in passing | Pre-flight P-3.1: `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED=false` grep must return 0 matches before dispatch. AC-3.16(a). |

---

## ADRs Cited in Council Session

- **ADR-0078** — Channel pinning (Stage Engine routing layer; cited as layer 2 of Rule 9 3-layer defense)
- **ADR-0112** — Type contract same-commit gate (SchedShiftPayload migration analogy)
- **ADR-0151** — Forgeable ID prevention (Rule 7 workspace check)
- **ADR-0173** — Frozen-4 namespace boundaries (Pattern B vs own-namespace)
- **ADR-0204** — gatedMutation requirement (G4 gap)
- **ADR-0287** — Atomicity guarantee (shift_session + shift_zone same transaction)
- **ADR-0309** — One emit per bundle (SchedulerProposalAccepted; per-shift array required for audit reconstruction)
- **ADR-0356** — Pattern B audit symmetry (cross-namespace delegated_via + actor_capability)
- **ADR-0427** — Forward-only discipline (atomic RPC deferred to PLAN-N)
- **ADR-0430** — Shift × zone M2N contract (Rules 1-9; the plan under review)

---

## Learnings to Log

| ID | Pattern | Where to log |
|----|---------|-------------|
| L-0083-recurrence-3 | authority-seed-inert: gate_action PL/pgSQL does not consume channel_constraint despite seed presence. Third occurrence (MF-A). | claude-mem + activity-log |
| MF-F-class | Delegation routes must not emit; emit belongs to the called action. BFF = thin pass-through. | claude-mem (mobile BFF pattern) |
| MF-G-class | Post-PLAN commit drift shifts line refs before sub-dispatch; always re-grep rather than trusting plan line refs. | research-log |
| MF-E-class | Bundle-level telemetry must key per-entity when the bundle contains heterogeneous entities; flat array = audit gap. | council SKILL.md (bundle event shape) |
