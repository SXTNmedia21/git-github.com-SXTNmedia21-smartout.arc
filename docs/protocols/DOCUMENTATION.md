---
title: "Documentation Protocol"
id: PROTO_DOCUMENTATION
status: canonical
layer: protocol
created: 2026-03-01
updated: 2026-03-01
---

# Documentation Protocol

> High-level enforcement. Every agent and developer MUST follow these rules. No exceptions.

---

## Source of Truth Hierarchy

1. **Code + database schema** — implementation always wins
2. **CLAUDE.md** — conventions, rules, verified facts
3. **docs/reference/** — detailed lookup during coding
4. **docs/engines/** — industry engine packaging (event specialization, council, policies, templates, testing, handbook)
5. **docs/modules/** — business logic per module
6. **docs/architecture/** — system design decisions
7. **docs/cross-cutting/** — concerns spanning modules
8. **docs/archive/** — historical, never loaded actively

If code contradicts docs → **code wins**. Update the doc immediately.

---

## Before Starting Work

1. Read `docs/decisions/0000-decision-log.md` — check for relevant ADRs
2. Read `docs/learnings/0000-learning-log.md` — check for relevant learnings
3. Read relevant industry package in `docs/engines/` when work touches event/journey/testing/readiness behavior
4. Reference applicable records in your approach

---

## During Work

| Trigger                                    | Action                                                    |
| ------------------------------------------ | --------------------------------------------------------- |
| Architectural choice that affects workflow | Write ADR → `docs/templates/decision.md`                  |
| Discovery that changes understanding       | Write Learning → `docs/templates/learning.md`             |
| New architecture system                    | Write Architecture doc → `docs/templates/architecture.md` |
| Multi-step implementation                  | Write Plan → `docs/templates/plan.md`                     |

---

## After Work

1. Register any new ADRs in `docs/decisions/0000-decision-log.md`
2. Register any new Learnings in `docs/learnings/0000-learning-log.md`
3. Add new docs to `docs/INDEX.md`
4. If CLAUDE.md conventions changed → update CLAUDE.md

---

## YAML Frontmatter

Every doc file MUST have YAML frontmatter:

```yaml
---
title: "Document Title"
id: UNIQUE_ID
status: canonical | draft | superseded | archived
layer: reference | module | architecture | cross-cutting | plan | protocol | decision | learning
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

---

## What NOT To Do

- Never load `docs/archive/` — it's superseded content
- Never create docs without YAML frontmatter
- Never skip INDEX.md registration
- Never edit `database.types.ts` manually — regenerate it
- Never implement event-layer behavior without checking the relevant industry engine package in `docs/engines/`
