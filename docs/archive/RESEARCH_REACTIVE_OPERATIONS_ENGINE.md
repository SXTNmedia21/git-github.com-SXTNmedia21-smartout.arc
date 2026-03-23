# Research: The Reactive Operations Engine

> **Scope:** Small, focused. Five questions that define the complete system.
> **Goal:** Find the patterns that let us wire six systems into one self-running machine.
> **Priority:** Q1 + Q2 block everything. Q3-Q5 inform design but don't block schema.

---

## What We're Building (in one paragraph)

A system where an economic model (season → period → day → hour, each with a revenue weight) drives staffing targets, which drive shift scheduling, which drive daily operational sessions, which trigger automated procedures and compliance checks — and where changing ANY input propagates through the entire chain with preview-before-commit and full audit trail. A compliance layer runs perpendicular to this chain, gating actions (shift assignment, punch-in, task assignment) based on readiness. The system learns from its own output: actual vs planned feeds back into the next planning cycle. And it must produce useful output from day one, before any historical data exists.

---

## The Five Questions

| #   | Question               | What it answers                      | Blocks what?                                | Priority |
| --- | ---------------------- | ------------------------------------ | ------------------------------------------- | -------- |
| Q1  | **Propagation**        | How changes flow through the system  | Everything — this is the engine             | **NOW**  |
| Q2  | **Time Segments**      | How seasons have internal structure  | Operating hours schema, factor calculations | **NOW**  |
| Q3  | **Self-Healing**       | How the system learns and improves   | Factor suggestions, staffing accuracy       | Phase 3+ |
| Q4  | **Compliance Overlay** | How rules constrain without coupling | Readiness gating, procedure triggers        | Parallel |
| Q5  | **Bootstrap**          | How to start from nothing            | Onboarding, first-time experience           | Parallel |

---

## Q1: The Propagation Pattern (BLOCKING)

When one layer changes, how do dependent layers react?

**Search for:**

- "Desired state reconciliation" — Kubernetes: declare what you want, system computes the diff
- "Terraform plan/apply" — compute the diff, show it to human, execute on confirmation
- "Event sourcing" — every change is an immutable event, current state is computed
- "Saga pattern" — multi-step transactions with compensation (rollback)
- "Reactive spreadsheet" — cells depend on cells, change propagates automatically
- "CQRS" — separate read/write models, events connect them

**The specific question:** Is our cascade pull-based (dependent layers recompute when queried), push-based (source notifies dependents on change), or hybrid (Terraform-style: compute diff on demand, apply on confirmation)?

**For each pattern found, report:**

1. Pattern name
2. How it works (3-5 sentences max)
3. One real-world system that uses it
4. How it maps to Smartout's six systems
5. The trade-off (complexity, performance, auditability)

---

## Q2: Time-Segmented Operations (BLOCKING)

How do you model "different rules for different time periods within the same season"?

**Search for:**

- "Revenue management time segmentation" — how hotels/airlines divide seasons into demand periods
- "Production scheduling with variable demand periods" — manufacturing shift planning across demand curves
- "Factor curves vs flat factors" — mathematical approaches to non-uniform time weighting
- "Season sub-periods in operational planning" — any system with ramp-up / peak / wind-down phases

**The specific question:** Is a "period" a first-class entity (its own table with its own factors, hours, and rules) or a date-range overlay on existing season-level data?

**For each approach found, report:**

1. Approach name
2. How it structures time segments
3. One real-world system that uses it
4. How it maps to Smartout's season → period → day → hour model
5. The trade-off (schema complexity vs flexibility)

---

## Q3: Self-Healing / Self-Evolving (Phase 3+)

How does the system learn from its own output?

**Search for:**

- "Closed-loop planning" — plan → execute → measure → adjust
- "Factor learning from actuals" — adjusting prediction weights based on observed vs expected
- "Operational digital twin" — running a model alongside reality to detect divergence
- "Self-tuning scheduling" — systems that adjust their own parameters

**The specific question:** Where does learning happen — economic model (adjust factors), scheduling (adjust templates), compliance (adjust procedures), or all three? And how do you bootstrap with zero history?

---

## Q4: The Compliance Overlay (Parallel)

How does a perpendicular rule system (policy → readiness) attach to the operational pipeline without tight coupling?

**Search for:**

- "Policy enforcement point pattern" — how API gateways enforce rules without embedding them in services
- "Aspect-oriented compliance" — compliance as a cross-cutting concern, not embedded in business logic
- "Guard conditions in state machines" — transitions that check external conditions before allowing
- "Capability-based access control" — "you can do this IF you have these capabilities (readiness)"

**The specific question:** Should compliance be a gate (blocks action until condition met) or an overlay (action proceeds, non-compliance is flagged and tracked)? Or configurable per workspace?

---

## Q5: The Bootstrap Problem (Parallel)

When a workspace has zero history, how does the cascade produce useful output?

**Search for:**

- "Cold start problem in recommendation systems" — how systems bootstrap without user data
- "Template-driven initialization" — pre-configured defaults that give the system something to cascade from
- "Industry-specific seed data" — domain knowledge as initial configuration

**The specific question:** Should industry intelligence packages produce actual database records (department_schedule rows, session_hook configs, policy records) or advisory suggestions that the admin confirms? The cascade engine needs data to exist — empty tables produce empty cascades.

---

## Desired Output

For Q1 and Q2 (blocking): detailed pattern comparison with clear recommendation.
For Q3-Q5 (parallel): pattern name + one paragraph each. Enough to inform design, not enough to delay building.

Total: ~3 pages. A decision aid, not a report.
