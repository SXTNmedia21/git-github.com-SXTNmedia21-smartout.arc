---
title: "Knowledge System Protocol"
id: PROTO_KNOWLEDGE
status: canonical
layer: protocol
created: 2026-03-01
updated: 2026-03-01
---

# Knowledge System Protocol

> High-level enforcement. No undocumented decisions. No lost learnings.

---

## Purpose

Every choice and discovery that affects how agents and developers work is written down so future sessions don't accidentally contradict past decisions or rediscover known solutions.

---

## Project Init Checklist

When starting a new project, verify these exist before any other work:

| Folder            | File                   | Purpose                       |
| ----------------- | ---------------------- | ----------------------------- |
| `docs/decisions/` | `0000-decision-log.md` | Master index of all ADRs      |
| `docs/learnings/` | `0000-learning-log.md` | Master index of all learnings |
| `docs/templates/` | 4 template files       | Consistent document creation  |

---

## When to Write

| Type               | Trigger                                                      | Examples                                                                    |
| ------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| **Decision (ADR)** | Architectural choice that affects how agents/developers work | New dependency, schema pattern, integration, pipeline change, tech choice   |
| **Learning**       | Discovery that changes understanding or approach             | Bug root cause, performance insight, API gotcha, pattern that worked/failed |

---

## Templates

All templates live in `docs/templates/`:

| Template       | File                             | After writing                                     |
| -------------- | -------------------------------- | ------------------------------------------------- |
| Decision (ADR) | `docs/templates/decision.md`     | Register in `docs/decisions/0000-decision-log.md` |
| Learning       | `docs/templates/learning.md`     | Register in `docs/learnings/0000-learning-log.md` |
| Architecture   | `docs/templates/architecture.md` | Add to `docs/INDEX.md`                            |
| Plan           | `docs/templates/plan.md`         | Add to `docs/INDEX.md`                            |

---

## Enforcement

⛔ **Before work:** Check decision log + learning log for relevant records.
⛔ **During work:** Write ADR or Learning when triggered.
⛔ **After work:** Verify all new records are registered in master logs.
