---
name: mental-note
description: Use the moment you (any agent) learn something worth remembering across runs — a trap, a path, a gotcha, a decision, a "next time do X". Take a mental note NOW — persist one durable fact to your own agent_id-keyed memory immediately, don't wait for session end. The write-trigger for the agent-memory the boot reads back. Symptoms — "I should remember this", "note to self", "next time", discovering a recurring trap mid-task.
updated: 2026-06-03
---

# Mental Note

The **write side** of agent memory. `work-mode-core` says *read your memory on mount* — this is how it
got there. The instant you learn something durable, **take the note right away.** A mental note deferred
to session-end is a mental note lost.

## When — the trigger

Any of these, the moment it happens (not later):
- a trap you hit and want to never hit again
- a path / file / command you had to hunt for
- a decision + its reason
- a "next time, do X instead"
- a gotcha that will recur

If you think *"I should remember this"* — that thought **is** the trigger. Take the note now.

## How — one fact, one file, immediately

Write `.claude/agent-memory/<agent_id>/<short-kebab-slug>.md`:

```markdown
---
name: <short-kebab-slug>
description: <one line — so future-you finds it on mount>
type: trap | path | decision | gotcha | next-time
---

<the fact, in your own words. Why it matters. What to do.>
[[related-note-slug]]   <!-- link liberally; a dangling link marks a note worth writing later -->
```

- **`<agent_id>`** = your own id (same key the log-standard + roster use). Your notes; no one else writes them.
- **One fact per file.** Don't append to a junk-drawer; each note is findable on its own.
- **Now, not at /end-session.** Right away. That's the whole point.

## Rough telemetry (optional — thumbs-up, not precision)

If telemetry is on, emit a coarse "noted" per category (`type`) — a thumbs-up the harness can count, not an
exact measure. Skip if it adds friction; the note itself is the deliverable.

## Read side (the loop closes)

On next mount, `campaign-boot` / `work-mode-core` reads `.claude/agent-memory/<agent_id>/` back — your
notes return as context. Write now → read next run → never amnesiac. That is how the roster gets smarter
across waves.

## Red flags — STOP

- "I'll write it at the end" → no. The end is where notes die. Now.
- Appending five facts to one file → one fact, one file (findable).
- Writing someone else's memory → only `<your-agent_id>/`.
