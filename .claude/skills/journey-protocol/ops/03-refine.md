# Op 3: Refine

> Status transition: `defined → ready_impl`. Input: `<slug>.spec.yaml` from op 2. Output: `<slug>.refined.yaml` — IR with code-binding evidence + capability authority verified.
>
> Spec is decoupled from running code. Refine binds it. This is where phantom-emit and phantom-consumer are caught.

## When this op runs

- User has a `<slug>.spec.yaml` and says "refine"
- After `/journey-protocol spec` completes
- Re-running after spec edits

## What this op does

For every step in the spec, verify it's wired:

| Trigger type | Verification |
|---|---|
| `dom_event` | `grep -rn "data-journey='<step.key>'" apps/web/src apps/mobile/src` returns ≥ 1 match |
| `network_response` | `grep -rn "<path>" apps/web/src/app/api packages/ai supabase/functions` matches |
| `server_event` | `<event_name>` appears in `packages/telemetry/src/registry.ts` |
| `state_predicate` | poll target table exists; predicate is deterministic |
| `absence` | the step it depends on (`after`) exists in same IR |

For every capability the journey invokes:

- Capability is one of the four frozen names (`run_dev`, `run_guided`, `publish_mission`, `publish_guide`)
- Authority is seeded — find row in `engine_authority_config` (or migration that seeds it)
- No new capability is being defined (refuse, ADR-class)

For every event referenced (in steps, success_gate, prerequisites, terminates):

- Event is in `packages/telemetry/src/registry.ts`
- All four destinations declared (analytics, logger, audit, event_store)
- No off-registry events (phantom-emit guard)

For every predicate / assertion:

- Deterministic (no LLM calls, no wall-clock-dependent logic, no random)
- References real event names or state values

## Output

`<slug>.refined.yaml` — same structure as spec, plus `_binding:` annotations on each step:

```yaml
steps:
  - key: "step.form.email_filled"
    title: "Type email"
    # ... existing spec fields ...
    _binding:
      verified_at: "2026-04-28T15:30:00Z"
      selector_match: "apps/web/src/components/landing/NewsletterForm.tsx:42"
      capability: "journey.run_guided"
      authority_seed: "supabase/migrations/20260516000200_seed_journey_authority.sql:12"
```

Plus a `_refine_summary:` block at root:

```yaml
_refine_summary:
  refined_at: "2026-04-28T15:30:00Z"
  refined_by: "<user>"
  steps_total: 8
  steps_bound: 8
  events_in_registry: 12
  capabilities_used: ["journey.run_guided"]
  warnings: []
  errors: []
```

## Process

1. **Open spec file.** Parse YAML.
2. **For each step, run binding verification.** Use `Bash` with grep. Record line refs.
3. **For each capability, verify authority seed.** Find migration row.
4. **For each event, check registry.** `grep` against `packages/telemetry/src/registry.ts`.
5. **Check predicates for determinism.** Static analysis — flag any reference to `Date.now()`, `Math.random()`, LLM calls.
6. **Generate refined.yaml** with `_binding` + `_refine_summary` annotations.
7. **Report to user:** "Refine: 8/8 steps bound, 12 events in registry, 1 capability seeded. Ready for approve."

If any verification fails:

- Stop. Report to user with line refs.
- Do not write `refined.yaml` until errors are fixed.
- Suggest: amend spec, or ask user to wire the missing code first.

## Refuse if

- Spec is missing required fields (point at validator)
- Any selector does not exist in code (offer: amend spec OR ship code first)
- Any event is not in registry (offer: add to registry via separate ADR-class change)
- Capability count would exceed 4 (refuse, ADR-class)
- A predicate uses non-deterministic input (mandatory fix)

## See also

- `ops/04-approve.md` — what runs after this
- `docs/engines/system-intelligence/05-protocol-pipeline.md` §2.3
- `docs/engines/system-intelligence/01-prd.md` §15 (testability rules — phantom-emit, phantom-consumer)
- `docs/engines/system-intelligence/11-handoff-capstone.md` (existing 4 capabilities + authority seed migration line refs)
