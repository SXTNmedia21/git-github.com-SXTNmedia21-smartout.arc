---
title: Polish Pipe Fix + Skill Update Implementation Plan
status: ready
updated: 2026-05-14
created: 2026-05-14
module: smartout-page-polish + botsson-harness
tags: [plan, polish, dead-pipe, skill-update, adr-draft, harness-adapter]
---

# Polish Pipe Fix + Skill Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land council-verdict P0 cleanup (demote false skill claims about runtime pipe, mark 42 dead-pipe client-tool files, write council log + 3 learnings, draft ADR-0327 HarnessAdapter frontmatter+context+decision, add `transition-all` to strand 1 gate) — all in one commit story on `development`.

**Architecture:** Six task groups, each producing one commit. Group order: documentation truth-restoration first (skill demotion + council log + learnings), then ADR frontmatter, then mechanical markers across `_tools/`, then husky gate extension. No app code changes; no behavior changes; pure annotation + documentation truth restoration.

**Tech Stack:** Markdown (skill + ADR + council log + learnings), bash grep one-liner addition to `.husky/pre-commit`, file-header comment line in 42 TypeScript files. No tests change behavior; pre-commit hook verification is the only "test" surface.

**Predecessor state:** Working tree clean at `afb94186d`, `development` branch, strand 1 gate exec-bit `-rwxr-xr-x`, handoff at `docs/handoffs/HANDOFF-2026-05-14-polish-wave-council-harness-adapter.md`.

**Scope expansion from handoff Q4 default:** Handoff said "17 dead-pipe `_tools/use-*-tools.ts` files" (this-session-shipped only). Plan marks all 42 polished `_tools/use-*-tools.ts` files because same defect class (none reach LLM today). Annotation is mechanical; coverage cost is identical; future-restore correctness improves.

---

## File Structure

Files this plan touches:

| File | Action | Responsibility |
|---|---|---|
| `.claude/skills/smartout-page-polish/SKILL.md` | Modify | Demote Phase 7 runtime-claim, demote Phase 8 site-map.json injection claim, add Phase 0 prerequisite check, add Phase 9 mobile-parity check, add scope-naming convention to Phase 7.5, add 2 Common Mistakes entries, add Runtime Status block |
| `docs/council/COUNCIL-LOG.md` | Append | Record 2026-05-14 council verdict + L-0147 4th occurrence |
| `docs/learnings/0264-skill-claim-trace-trap.md` | Create | Pre-flight fact-check must grep alleged consumer of any artifact skill text references |
| `docs/learnings/0265-lint-staged-stash-restore-drops-bundle-edits.md` | Create | Lint-staged stash-restore can drop staged page.tsx edits when bundle mixes staged + unstaged file deltas |
| `docs/learnings/0266-wsl-strips-husky-exec-bit.md` | Create | WSL filesystem strips exec bit on `.husky/*` when edited; `git update-index --chmod=+x` required to commit mode |
| `docs/learnings/0000-learning-log.md` | Append | Register 0264, 0265, 0266 entries |
| `docs/decisions/0327-harness-adapter-unified-llm-consumer.md` | Create | ADR proposed: frontmatter + context + decision section (body deferred to dedicated sortie per Pontus Q2) |
| `docs/decisions/0000-decision-log.md` | Append | Register ADR-0327 as proposed |
| `apps/web/src/app/dashboard/**/_tools/use-*-tools.ts` (42 files) | Modify | Add `// DEAD-PIPE-2026-05-14: ...` marker line at file top, below `"use client"` pragma |
| `.husky/pre-commit` | Modify | Strand 1 §10 extension: block `transition-all` on added lines in dashboard files |

---

## Task 1: Skill Demotion + Phase 0/9 Additions

**Files:**
- Modify: `.claude/skills/smartout-page-polish/SKILL.md`

This task corrects 2 false runtime claims in the skill and adds 4 new sections (Phase 0 pre-polish capability check, Phase 9 mobile parity check, scope-naming convention, 2 Common Mistakes entries). Handoff Edit 1-7 maps to this task.

- [ ] **Step 1.1: Read current skill to locate Phase 7 + Phase 8 anchor points**

Run:
```bash
grep -n "Phase 7\b\|Phase 8\b\|## Phase\|### Phase\|## Common Mistakes\|## Cross-References" .claude/skills/smartout-page-polish/SKILL.md
```

Expected: line numbers for Phase 7, Phase 7.5, Phase 7.6, Phase 8, Common Mistakes, Cross-References sections. Use these to scope the edits.

- [ ] **Step 1.2: Insert "Runtime Status (2026-05-14)" block at start of Phase 7**

Find the first heading line of Phase 7 (e.g. `## Phase 7 — Botsson Tools (useRegisterTools)` or similar). Immediately after its overview paragraph, insert:

```markdown
### Runtime Status (2026-05-14 — council finding)

**Phase 7 client registry:** wired ✅ (registry singleton stores kits, BotssonProvider merges into `botssonTools`).

**Phase 7 client → LLM delivery:** MISSING 🔴
  - Voice path: `/api/wizard/start` route silently drops `body.selected_tools`. `LiveKitVoiceSession.registerTool()` at `packages/agent-sdk/src/providers/livekit.ts:38-40` is a stub.
  - Chat path: `/api/botsson/chat` forwards no tool fields. `services/stage-engine/src/routes/agent/chat.ts` schema has no `client_tools` receiver.

**Consequence:** tools registered via `useRegisterTools` cannot be invoked by Botsson today on either channel. They exist in browser memory for future hot-swap when the HarnessAdapter (see ADR-0327) ships.

**Do NOT remove `useRegisterTools` calls.** The registry is the upstream source the HarnessAdapter will read from. Polish-wave Phase 7 work is correct preparation; the consumer pipe is what's missing.

**See:** `docs/handoffs/HANDOFF-2026-05-14-polish-wave-council-harness-adapter.md` (full code-trace), ADR-0327 (proposed unified adapter).
```

- [ ] **Step 1.3: Demote Phase 8 site-map.json injection claim**

Locate the paragraph in Phase 8 that begins "the bootstrap pipe BFF → context_init → voice-agent..." (and "reads this JSON and injects `## Sidekart`"). Replace the entire "Why this matters" paragraph with:

```markdown
**Status (2026-05-14):** site-map.json is currently a **documentation + drift-detection artifact only**. The BFF → context_init injection pipe described in prior versions of this skill does NOT exist in code. ADR-0327 (proposed) draft pending — unified HarnessAdapter, sortie next.

Once the HarnessAdapter ships, site-map.json will be the canonical route catalog read by every LLM consumer (chat, voice, future Slack/email/API). Until then, Phase 8 entries serve:
- Drift validator (`pnpm site-map:validate`) — enforces `useRegisterTools` ↔ JSON entry consistency
- Human reference — what surfaces have been polished, what tools they expose
- Future-target — HarnessAdapter will read this JSON when injection ships
```

In the failure-modes table within Phase 8, append `(pending HarnessAdapter ship — ADR-0327)` to each row whose failure mode assumes runtime site-map injection.

- [ ] **Step 1.4: Add Phase 0 (pre-polish capability check) before existing Phase 1**

Insert new section before the current Phase 1 heading:

```markdown
## Phase 0 — Pre-Polish Capability Check

Before starting Phase 1, verify the page's data is actually available to the runtime LLM:

1. Does a relevant backend capability exist in `packages/ai/src/capabilities/`? If yes, this page's tools may overlap — name them distinctly to avoid collision.
2. Is `gate_action` seeded for the relevant workspace? (Check `engine_authority_config`.)
3. Is the telemetry registry entry written? (For any planned mutation in Phase 5.)
4. Is the data hook used by this page in `packages/` (mobile parity) or `apps/web/` (web-only)? Per ADR-0133/0134, shared logic in packages.

If any answer is "no, but planned for this polish session," ship the prerequisite first (separate commit).
```

- [ ] **Step 1.5: Add Phase 9 (mobile parity verification) after current last Phase**

Locate the last Phase section (Phase 8 or Phase 8.x). After its final content and before "## Cross-References" (or similar trailing section), insert:

```markdown
## Phase 9 — Mobile Parity Verification

Before flipping `verified: true` in run.yml, verify ADR-0133 alignment:

1. Are the data hooks this page uses living in `packages/` (not `apps/web/src/hooks/`)?
2. If this page handles a "verb" that mobile owns per ADR-0133 (Approve/Execute/Witness/D6 production), does a mobile counterpart exist in `apps/mobile/src/`?
3. If not, document in `run.yml` under `mobile_parity:` field as `pending` with linked issue.

Mobile-polish is a separate skill (planned: `smartout-mobile-polish`). Phase 9 here is only the data-layer parity check, not visual parity.
```

- [ ] **Step 1.6: Add Scope-Naming Convention to Phase 7.5**

Locate Phase 7.5 (tool-implementation patterns, 6 subsections). Append a new subsection `§7`:

```markdown
### §7 Scope-Naming Convention

Rule: `<parent-route-segment>-<leaf>` for nested routes, hyphenated, lowercase.

Examples:
- `/dashboard/hms/deviations` → scope `hms-deviations` ✅
- `/dashboard/settings/operations` → scope `settings-operations` ✅
- `/dashboard/billing/[invoice_id]` → scope `billing-invoice-detail` (NOT `invoice-detail`) ✅
- `/dashboard/contracts/[id]` → scope `contracts-detail` (NOT `contract-detail` — match parent route segment) ✅
- `/dashboard/contracts/awaiting-my-signature` → scope `contracts-awaiting-signature` ✅

Validator may warn (P2): scope without parent-route-segment prefix.

Existing scopes shipped before 2026-05-14 are grandfathered; do not rename. Apply rule to new scopes only.
```

- [ ] **Step 1.7: Add 2 Common Mistakes entries**

Locate the Common Mistakes table. Append two rows:

```markdown
| Trusting skill text claims about runtime pipes without code-trace verification | Pre-flight fact-check must include grep for the alleged consumer of any artifact the skill text references. Phase 7 + Phase 8 false-claim 2026-05-14 occurred because skill text wasn't trace-verified. L-0147 4th occurrence. See `docs/learnings/0264-skill-claim-trace-trap.md`. |
| Writing skill text describing pipe behavior in present tense without verifying in last 30 days | Skill text drifts from reality faster than code does. Mark aspirational claims as "future-target" or annotate with verified-date footer. |
```

- [ ] **Step 1.8: Update skill frontmatter `updated:` field**

Find the YAML frontmatter at top of SKILL.md. Change `updated:` to `2026-05-14`.

- [ ] **Step 1.9: Verify edits landed**

Run:
```bash
grep -n "Runtime Status (2026-05-14" .claude/skills/smartout-page-polish/SKILL.md
grep -n "Phase 0 — Pre-Polish" .claude/skills/smartout-page-polish/SKILL.md
grep -n "Phase 9 — Mobile Parity" .claude/skills/smartout-page-polish/SKILL.md
grep -n "Scope-Naming Convention" .claude/skills/smartout-page-polish/SKILL.md
grep -n "ADR-0327" .claude/skills/smartout-page-polish/SKILL.md
grep -c "DEAD-PIPE\|MISSING 🔴\|future-target" .claude/skills/smartout-page-polish/SKILL.md
```

Expected: each grep returns at least one matching line. Final grep returns count ≥ 3.

- [ ] **Step 1.10: Commit**

```bash
git add .claude/skills/smartout-page-polish/SKILL.md
git commit -m "$(cat <<'EOF'
docs(skill): demote page-polish Phase 7/8 false claims + add Phase 0/9 + scope-naming

Council 2026-05-14 found Phase 7 (useRegisterTools → LLM) is dead-pipe and Phase 8
(site-map.json → ## Sidekart injection) is aspirational-shipped-as-factual. Two break
points: /api/wizard/start drops body.selected_tools; LiveKitVoiceSession.registerTool
is a stub. Chat path has no client_tools field at all.

This commit corrects skill text to match runtime reality and adds Phase 0 (pre-polish
capability check) + Phase 9 (mobile parity check) + scope-naming convention to Phase 7.5
+ 2 Common Mistakes entries. App code unchanged.

See HANDOFF-2026-05-14-polish-wave-council-harness-adapter.md for full council trace
and ADR-0327 (proposed) for the unified HarnessAdapter that will close the dead pipe.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Council Log + 3 Learnings

**Files:**
- Modify: `docs/council/COUNCIL-LOG.md` (append entry)
- Create: `docs/learnings/0264-skill-claim-trace-trap.md`
- Create: `docs/learnings/0265-lint-staged-stash-restore-drops-bundle-edits.md`
- Create: `docs/learnings/0266-wsl-strips-husky-exec-bit.md`
- Modify: `docs/learnings/0000-learning-log.md` (append registrations)

- [ ] **Step 2.1: Append council log entry**

Open `docs/council/COUNCIL-LOG.md`, append at end:

```markdown
## 2026-05-14 — Page-Polish Skill Audit + Harness Integration E2E

**Type:** post-implementation
**Verdict:** REJECT WITH CONSTRUCTIVE PLAN
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, botsson-harness-builder, frontend-designer
**Prior verdict held?** n/a — first council on polish-skill enforcement.

**Key finding:** 75 page-scope tools shipped this session are dead-pipe. Client registry is wired through `botssonTools`; pipe breaks at two distinct points:
- Voice: `/api/wizard/start` silently drops `body.selected_tools`. `LiveKitVoiceSession.registerTool()` is a stub.
- Chat: `/api/botsson/chat` forwards no tool fields. Stage-engine schema rejects `client_tools`.

**Skill text claim** about "BFF → context_init → voice-agent reads site-map.json and injects ## Sidekart" is FALSE-AS-SHIPPED — aspirational claim shipped as factual.

**Chair self-reversed:** YES — Phase 3 "Phase 7 wired e2e" → Phase 5 REVERSED with code-trace evidence (Agent-Coord + Harness-Builder reviewers walked the pipe step-by-step; Steward + Supervisor + Frontend initially accepted "wired"). **4th documented occurrence of L-0147 Chair Self-Reversal pattern.**

**Decisions:**
- Demote skill claims (Phase 7 + Phase 8) — landed in skill update commit.
- Mark 42 dashboard `_tools/use-*-tools.ts` files with `DEAD-PIPE-2026-05-14` quarantine marker — landed in dead-pipe-markers commit.
- Draft ADR-0327 (HarnessAdapter — unified LLM-consumer adapter). Frontmatter + context + decision only this session; body deferred to dedicated sortie.
- Polish-wave commits stand (correct in isolation: types compile, bridges mount, registry receives, conventions hold). The defect is in the skill text's claims, not in the code itself.

**ADR created:** 0326 (proposed)
**Learnings created:** 0264, 0265, 0266

**Other findings preserved for future sorties (not P0):**
- PII leak surface in `use-contract-detail-tools.ts` + `use-invoice-detail-tools.ts` (dormant — tools dead-pipe). To revisit when HarnessAdapter ships.
- No-mutation-on-financial-surfaces convention has no detector. Add path-aware grep to strand 1 in future sortie.
- 11 duplicate `modelToolName` values across scopes. Document or rename before HarnessAdapter routes tools to a single LLM context.
- Scope-naming inconsistency (3 axes) — convention added to skill Phase 7.5 §7; existing scopes grandfathered.
- Validator check 6 (drift) is no-op for the bridge pattern this session institutionalized. Harden validator before next polish wave.
- Strand 1 (just shipped) misses: `transition-all` added in this commit-story; `shadow-xl/2xl/drop-shadow` + financial-mutation-grep + dataRef-bypass-detector queued for future sortie.
```

- [ ] **Step 2.2: Create learning 0264 — skill-claim-trace-trap**

Write `docs/learnings/0264-skill-claim-trace-trap.md`:

```markdown
---
title: Pre-flight Fact-Check Must Grep Alleged Consumers of Artifacts
status: accepted
updated: 2026-05-14
created: 2026-05-14
module: process
tags: [council, fact-check, skill-drift, l-0147, code-trace]
---

# L-0264 — Pre-Flight Fact-Check Must Grep Alleged Consumers of Artifacts

**Date observed:** 2026-05-14
**Class:** documentation drift / aspirational-shipped-as-factual
**Related:** L-0147 (Chair Self-Reversal — 4th occurrence), `run-council` skill, `smartout-page-polish` skill

## What happened

The `smartout-page-polish` skill described a runtime pipe ("BFF → context_init → voice-agent reads site-map.json and injects `## Sidekart`") that does not exist in code. Three concept-level council reviewers (Steward, Supervisor, Frontend-Designer) initially accepted "Phase 7 is wired" in Phase 3. Two code-tracer reviewers (Agent-Coord, Harness-Builder) walked the pipe step-by-step in Phase 3 and surfaced the truth: 75 page-scope tools never reach any LLM.

In Phase 5 synthesis, chair (Steward) self-reversed the Phase 3 claim with code-trace evidence. This is the **4th documented occurrence** of L-0147 (Chair Self-Reversal — 2+ reviewers vote opposite to chair with code-trace evidence ⇒ chair MUST classify Phase 3 vote as REVERSED).

## Root cause

Skill text described a pipe in present tense (factual claim) without a verified-date annotation. The pipe was aspirational at write time; nobody traced it to code at council-Phase-2 fact-check time. Phase 2.5 fact-check focuses on schema/file existence, not on whether the alleged consumer of an artifact actually reads it.

## Rule (promote to `run-council` skill Phase 2.5)

> Pre-flight fact-check MUST include a grep for the **alleged consumer** of any artifact the briefing or skill text references.
>
> For every claim of form "X consumes Y" or "X reads Y" or "Y is injected into X":
> 1. Grep the codebase for an import or read of Y from within X's source tree.
> 2. If zero matches, flag as UNVERIFIED — the briefing must reclassify the claim as "future-target" or remove it before Phase 3 dispatch.
>
> Example: skill text says "voice-agent reads site-map.json". Grep `grep -rn "site-map" services/voice-agent/`. Zero matches ⇒ claim is FALSE-AS-SHIPPED.

## Forward action

- Promote rule to `run-council` skill Phase 2.5 (Briefing Fact-Check Gate)
- Add "Skill claim drift" to the Common-Mistakes table in `smartout-page-polish` skill (done in this commit-story)
- Run a one-pass audit of other Smartout skills for similarly-shaped aspirational claims (`smartout-cascade-developer`, `smartout-edge-function-guide`, `smartout-database-guide`) — separate sortie

## References

- Handoff: `docs/handoffs/HANDOFF-2026-05-14-polish-wave-council-harness-adapter.md` (full council trace, file:line citations for each break point)
- ADR-0327 (proposed) — Unified HarnessAdapter that will close the dead pipe
- Council log: `docs/council/COUNCIL-LOG.md` 2026-05-14 entry
```

- [ ] **Step 2.3: Create learning 0265 — lint-staged stash-restore**

Write `docs/learnings/0265-lint-staged-stash-restore-drops-bundle-edits.md`:

```markdown
---
title: Lint-Staged Stash-Restore Drops Bundle Edits When Mix Of Staged + Unstaged
status: accepted
updated: 2026-05-14
created: 2026-05-14
module: tooling
tags: [husky, lint-staged, commit-hygiene]
---

# L-0265 — Lint-Staged Stash-Restore Drops Bundle Edits When Mix of Staged + Unstaged

**Date observed:** 2026-05-14 (commit `0f901a637` — contracts sub-routes polish)
**Class:** tooling / commit-bundle integrity
**Related:** L-0259 (hook emit location drift), husky pre-commit chain

## What happened

Commit `0f901a637` ("feat(polish): contracts sub-routes") was supposed to include 3 `page.tsx` edits that mounted Botsson-tools bridges in the contracts sub-routes. Bundle contained staged `_tools/` directories (new files) AND `page.tsx` deltas (partially staged, partially unstaged on same hunks). Lint-staged ran prettier on `_tools/` files, formatted them, stashed unstaged deltas, restored stash — **but the unstaged deltas on `page.tsx` did not survive the restore**. Commit landed with `_tools/` files only; `page.tsx` wirings dropped silently.

Detection was post-commit: `git status` showed the 3 `page.tsx` files unstaged again. The bridges were never imported on the pages. Restored in commit `8b7976a37` ("feat(polish): billing sub-routes + contracts page wiring restore") by explicitly staging the 3 files before committing.

## Root cause

Lint-staged's stash strategy assumes hunks within a file are either fully staged or fully unstaged. When the same file has partially-staged hunks, the stash-restore can lose unstaged portions because conflict resolution defaults to "drop unstaged".

## Mitigation

Post-commit verification check:

```bash
# After any polish-wave commit, before pushing
git status --short
# Expect: empty (or only files explicitly intended to remain unstaged)
# If unexpected unstaged files appear: stage them, amend or follow-up commit
```

For polish-wave commits specifically: stage ALL changes (`git add -A` on the relevant paths) before commit, or use `git add -p` to ensure no partial-hunk states reach lint-staged.

## Promote to skill

`smartout-page-polish` skill — already has Common Mistakes entry from this session. No additional promotion needed; entry exists.

## References

- Handoff: `docs/handoffs/HANDOFF-2026-05-14-polish-wave-council-harness-adapter.md` (commit table notes the restore)
- Commits: `0f901a637` (drop), `8b7976a37` (restore)
```

- [ ] **Step 2.4: Create learning 0266 — WSL exec bit**

Write `docs/learnings/0266-wsl-strips-husky-exec-bit.md`:

```markdown
---
title: WSL Strips Exec Bit on .husky Hooks After Edit
status: accepted
updated: 2026-05-14
created: 2026-05-14
module: tooling
tags: [husky, wsl, git, file-mode]
---

# L-0266 — WSL Strips Exec Bit on .husky Hooks After Edit

**Date observed:** 2026-05-14 (commit `fe1b26dcc` shipped strand 1 hook content; commit `332da9c13` restored exec bit)
**Class:** tooling / WSL filesystem quirk
**Related:** strand 1 grep gate (`.husky/pre-commit` §10)

## What happened

After editing `.husky/pre-commit` to add the Nordic Split + motion-token drift gate (§10) via WSL editor, the file mode silently lost its executable bit. Subsequent `git commit` runs emitted advisory:

> hint: The '.husky/pre-commit' hook was ignored because it's not set as executable.

The hook was effectively silently disabled despite content shipping in commit `fe1b26dcc`. Detection was via the advisory text + manual test (committed a file that should have triggered §10 — gate did not fire).

## Root cause

WSL2 filesystem (drvfs / 9P) under default mount options does not preserve POSIX executable bits when files are edited through Windows-side editors. Git records file mode based on inode metadata; when WSL re-saves the file via a Windows editor (VS Code on Windows + WSL extension is a common path), the mode drops to `0644`.

## Mitigation

After any edit to a hook file, restore exec bit and commit the mode change:

```bash
chmod +x .husky/pre-commit
git update-index --chmod=+x .husky/pre-commit
git commit -m "chore(husky): restore exec bit on pre-commit"
```

`git update-index --chmod=+x` is required (not just `chmod`) because the mode change must enter the index — otherwise the next clone or worktree-create will receive a `0644` file.

## Verification

```bash
ls -la .husky/pre-commit
# Expect: -rwxr-xr-x ...
git ls-files --stage .husky/pre-commit
# Expect: 100755 <hash> 0  .husky/pre-commit (NOT 100644)
```

## Promote to skill

Add to onboarding-engineer-environment notes (if such doc exists) under WSL gotchas. Also add to `.husky/README.md` or top-of-file comment in `.husky/pre-commit` warning future editors.

## References

- Commit `fe1b26dcc` — shipped §10 content with mode `0644` (silently disabled)
- Commit `332da9c13` — restored mode to `0755`, committed mode change
```

- [ ] **Step 2.5: Append registrations to learning log**

Open `docs/learnings/0000-learning-log.md`. Append at end of the log table or list:

```markdown
| 0264 | Pre-flight fact-check must grep alleged consumers of artifacts | 2026-05-14 | L-0147 4th occurrence; promotes to run-council skill |
| 0265 | Lint-staged stash-restore drops bundle edits | 2026-05-14 | Mixed staged + unstaged hunks in same file |
| 0266 | WSL strips exec bit on .husky hooks | 2026-05-14 | Use git update-index --chmod=+x |
```

If the log uses a different table shape, match the existing format; key columns are ID, title, date, note.

- [ ] **Step 2.6: Verify all 4 files exist and registrations landed**

Run:
```bash
ls -la docs/learnings/0264-*.md docs/learnings/0265-*.md docs/learnings/0266-*.md
grep -c "2026-05-14 — Page-Polish Skill Audit" docs/council/COUNCIL-LOG.md
grep -c "0264\b\|0265\b\|0266\b" docs/learnings/0000-learning-log.md
```

Expected: 3 file listings, council-log grep returns ≥1, learning-log grep returns ≥3.

- [ ] **Step 2.7: Commit**

```bash
git add docs/council/COUNCIL-LOG.md docs/learnings/0264-*.md docs/learnings/0265-*.md docs/learnings/0266-*.md docs/learnings/0000-learning-log.md
git commit -m "$(cat <<'EOF'
docs(council): 2026-05-14 polish-skill audit verdict + 3 learnings

Council REJECT WITH CONSTRUCTIVE PLAN on page-polish wave: 75 page-scope tools
shipped this session are dead-pipe. Chair self-reversed Phase 3 with code-trace
evidence (L-0147 4th occurrence). Polish-wave code stands; skill text demoted
in companion commit.

Three learnings registered:
- 0264 skill-claim-trace-trap (promotes to run-council Phase 2.5)
- 0265 lint-staged stash-restore drops bundle edits
- 0266 WSL strips exec bit on .husky hooks (post-fix L-0266 documented)

See HANDOFF-2026-05-14-polish-wave-council-harness-adapter.md for full trace.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: ADR-0327 — HarnessAdapter Frontmatter + Context + Decision

**Files:**
- Create: `docs/decisions/0327-harness-adapter-unified-llm-consumer.md`
- Modify: `docs/decisions/0000-decision-log.md` (register as proposed)

Pontus's Q2 default: frontmatter + context + decision section only this session; body (alternatives weighed, consequences, implementation order detail) deferred to dedicated sortie.

- [ ] **Step 3.1: Verify ADR slot 0326 free**

Run:
```bash
git log --all --name-only 2>/dev/null | grep -E "^docs/decisions/0326-" | sort -u
grep "ADR-0327\|0326-" docs/decisions/0000-decision-log.md
```

Expected: zero matches on both. If any match, abort and pick next free slot.

- [ ] **Step 3.2: Read existing ADR template to match shape**

Run:
```bash
test -f docs/templates/decision.md && cat docs/templates/decision.md || ls docs/decisions/ | head -3
```

Expected: template content or recent ADR shape. Use the result to match frontmatter keys + heading order.

- [ ] **Step 3.3: Create ADR-0327**

Write `docs/decisions/0327-harness-adapter-unified-llm-consumer.md`:

```markdown
---
id: ADR_0327
title: SmartOut Harness — Unified LLM-Consumer Adapter
status: proposed
updated: 2026-05-14
created: 2026-05-14
deciders: pontus, claude-opus-4.7 (orchestrator)
supersedes: []
superseded_by: []
related: [ADR_0078, ADR_0133, ADR_0134, ADR_0151, ADR_0244, ADR_0297]
tags: [harness, botsson, llm-adapter, polish-wave, dead-pipe-fix]
---

# ADR-0327 — SmartOut Harness: Unified LLM-Consumer Adapter

## Status

**Proposed** — 2026-05-14. Body (alternatives weighed in full, consequences, implementation phases, test plan) deferred to dedicated sortie. This document captures the decision and just enough context that the next session can resume the design without re-deriving the problem.

## Context

Council 2026-05-14 (see `docs/council/COUNCIL-LOG.md` 2026-05-14 entry) surfaced that the page-polish wave's Phase 7 (`useRegisterTools`) and Phase 8 (`site-map.json`) artifacts are runtime-unconsumed.

**Current pipe state (file:line evidence):**

| Layer | Status | Evidence |
|---|---|---|
| L1 client tool registry | wired | `apps/web/src/app/Botsson/_components/tool-registry.ts:53-65` |
| L1 BotssonProvider aggregate | wired | `apps/web/src/app/Botsson/_components/BotssonProvider.tsx:715-742` |
| L1 → useAgent serializer | wired | `packages/agent-sdk/src/context/session-context.ts:28-29` writes `body.selected_tools` |
| L2 voice path `/api/wizard/start` | **BREAK** | `apps/web/src/app/api/wizard/start/route.ts:38-130` reads `mission_id`, `voice`, `language`, `first_speaker`, `context`. Does NOT read `selected_tools`. Field silently dropped. |
| L2 voice path LiveKit registerTool | **STUB** | `packages/agent-sdk/src/providers/livekit.ts:38-40` returns early with log message. |
| L2 chat path BFF schema | **MISSING FIELD** | `apps/web/src/app/api/botsson/chat/route.ts:38-59` `RequestSchema` has no tool-related field. |
| L3 stage-engine chat schema | **MISSING FIELD** | `services/stage-engine/src/routes/agent/chat.ts:1-167` accepts no `client_tools` field. `toVercelTools()` operates only on server-side `SmartoutTool` registry. |
| L4 site-map.json consumer | **NONE** | Zero consumers in `apps/web/src/` or `services/`. Only `apps/web/scripts/validate-site-map.ts` reads it (drift detector). |

**Consequence:** ~75 page-scope tools shipped 2026-05-14 + ~42 total polished `_tools/use-*-tools.ts` files cannot be invoked by Botsson on either chat or voice today. They register correctly client-side and disappear at the BFF boundary.

**Future-consumer multiplication risk:** Slack bot, email assistant, API agent — each would need its own integration plumbing if the current fragmented pattern continues. Three current channels (chat, voice, site-map injection) already have three different non-pipes. The pattern does not scale.

**Pontus's directive (verbatim, 2026-05-14):**

> "I want the context tools and descriptions, and everything needs to be set in the harness. I want to be able to connect voice agent, chat agent, any agent at all. I want to be able to connect it to SmartOut Harness. And it should be unified. It should be an adapter that's handling everything."

## Decision

Build a unified **`HarnessAdapter`** in `packages/ai/src/harness/` (new directory) exposing a single contract that every LLM consumer (chat agent, voice agent, future Slack/email/API agents) plugs into.

### Contract surface (proposed signature; refine in sortie body)

```typescript
interface HarnessAdapter {
  // Tool surface for a given consumer + context
  getToolsForChannel(
    channel: "chat" | "voice" | "slack" | "email" | "api",
    pageRoute: string | null,
    userContext: { profile_id: string; workspace_id: string; role: string }
  ): Promise<{
    definitions: ClientToolDefinition[];
    implementations: Record<string, ClientToolImplementation>;
    systemPromptSlices: string[];
    authority: AuthorityConfig;
  }>;

  // Route catalog (subset filtered by user access)
  getSiteMap(userContext: UserContext): Promise<SiteMap>;

  // Hot-swap on navigation (long-lived sessions like voice)
  subscribeToRouteChange(callback: (newRoute: string) => void): Unsubscribe;
}
```

### Authority enforcement (server-side, mandatory)

- `workspace_id` derived from session auth — never read from request body (ADR-0151)
- Channel restriction per tool surface (ADR-0078 — PII tools chat-only, voice forbidden)
- Financial-mutation block per ADR-0244 — adapter `getAuthority()` strips any mutation tool with `risk_tier: financial` from voice/passive surfaces
- Mobile boundary per ADR-0133 — adapter exposes only Approve/Execute/Witness verbs to mobile consumers

### Location

`packages/ai/src/harness/` (per handoff Q6 default) — shares type space with `packages/ai/src/capabilities/`, `packages/ai/src/adapters/`, `packages/ai/src/router/`. Becomes the formal L4-bridge that `BOTSSON-SYSTEM-MAP.md` has been missing.

### Build sequence (high-level — detail deferred to dedicated sortie)

1. **Phase 1:** Define `HarnessAdapter` interface + type contracts in `packages/ai/src/harness/`.
2. **Phase 2:** Implement registry source — adapter reads from client tool-registry singleton, capabilities registry, site-map.json, context-snapshot helper.
3. **Phase 3:** Chat consumer wired first (cheaper, no LiveKit dependency). Stage-engine BFF + `/agent/chat` schema accepts adapter output. Replace existing `toVercelTools` chain.
4. **Phase 4:** Voice consumer wired second. Fill `LiveKitVoiceSession.registerTool` stub. Voice-agent worker boots from adapter. Hot-swap on route change via LiveKit data channel.
5. **Phase 5:** Authority layer enforced server-side in adapter `getAuthority()`.
6. **Phase 6:** Future consumers (Slack/email/API) plug in via same interface — documented pattern.

### Decisions deferred to sortie body

- Adapter location confirmed `packages/ai/src/harness/` vs alternative `services/harness-adapter/` (new service)?
- Voice tool-delivery transport: LiveKit data channel vs RPC vs custom WebSocket?
- Hot-swap mechanism: per-route refresh vs session-fixed?
- Token-budget management: full site-map vs on-demand `requestSiteMap()` tool?
- Test strategy: integration tests vs trace-based contract tests?

## Consequences (high-level — full enumeration deferred)

**Positive:**
- Closes 75 dead-pipe tools shipped 2026-05-14 + 42 total polished `_tools/` files
- Single contract for any future LLM consumer (3rd-party agent, internal Slack bot, email assistant)
- Authority enforcement centralized — ADR-0078/0151/0244 enforced in one place, not per-consumer
- Skill text claims (Phase 7 + Phase 8 of `smartout-page-polish`) become factual once Phase 3 ships

**Negative / risks:**
- Single point of failure if adapter has a bug — every LLM consumer fails together
- Migration cost: existing capability-tool chain via `toVercelTools` needs refactor (not rewrite)
- Token budget for full site-map injection may exceed context limits — mitigation: on-demand tool

**Neutral:**
- Skill text demotion (companion commit) signals to readers that runtime claims are pending — no breakage of existing tests or types

## Related

- ADR-0078 — Channel pinning (PII chat-only)
- ADR-0133 — Mobile surface boundary (verbs split)
- ADR-0134 — Mobile telemetry contract (workspace_id/actor_id resolution)
- ADR-0151 — workspace_id auth-derived (never body-forged)
- ADR-0244 — Financial mutation risk tier
- ADR-0297 — Workforce bootstrap pipe (precedent for context-injection pattern)
- L-0147 — Chair Self-Reversal pattern (this council 4th occurrence)
- L-0233 — Two LLM contexts trap (voice-agent + stage-engine prompt-context divergence)
- L-0264 — Pre-flight fact-check must grep alleged consumers (root cause of council finding)
- Handoff: `docs/handoffs/HANDOFF-2026-05-14-polish-wave-council-harness-adapter.md` — full code-trace evidence + open questions + skill-update plan
- Council log: `docs/council/COUNCIL-LOG.md` 2026-05-14 entry
```

- [ ] **Step 3.4: Register ADR-0327 in decision log**

Open `docs/decisions/0000-decision-log.md`. Append to the proposed-ADR section (or wherever current entries live — match shape of recent registrations):

```markdown
| ADR-0327 | SmartOut Harness — Unified LLM-Consumer Adapter | proposed | 2026-05-14 | Closes dead-pipe between polished `_tools/` files and any LLM consumer (chat/voice/future). Frontmatter + context + decision only this session; body deferred. |
```

If the log uses a different shape (numbered list, headings), match its convention; key fields are ID, title, status, date, note.

- [ ] **Step 3.5: Verify ADR + registration landed**

Run:
```bash
ls -la docs/decisions/0327-harness-adapter-unified-llm-consumer.md
grep -c "ADR-0327\|0327-harness" docs/decisions/0000-decision-log.md
grep -c "## Status\|## Context\|## Decision" docs/decisions/0326-*.md
```

Expected: file exists, decision-log grep returns ≥1, ADR file has all 3 required headings.

- [ ] **Step 3.6: Commit**

```bash
git add docs/decisions/0327-harness-adapter-unified-llm-consumer.md docs/decisions/0000-decision-log.md
git commit -m "$(cat <<'EOF'
docs(adr): ADR-0327 proposed — unified HarnessAdapter (frontmatter+context+decision)

Council 2026-05-14 verdict requires unified adapter to close dead-pipe between
polished client tools and any LLM consumer (chat/voice/future Slack/email/API).
Three current channels each have a different non-pipe; pattern does not scale.

Frontmatter + context + decision sections this commit. Body (alternatives weighed,
consequences enumerated, implementation phases detailed, test strategy) deferred
to dedicated sortie per Pontus Q2 default.

Pontus directive captured verbatim. File:line evidence for each break point
captured in Context section. Build sequence sketched (Phase 1-6).

See HANDOFF-2026-05-14-polish-wave-council-harness-adapter.md + L-0264.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Dead-Pipe Quarantine Markers on All 42 _tools Files

**Files:**
- Modify: 42 files matching `apps/web/src/app/dashboard/**/_tools/use-*-tools.ts`

Add `// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)` as the second line of each file (immediately after `"use client";` pragma, with blank line separator).

**Scope expansion note:** Handoff Q4 default said "17 dead-pipe files" (this-session-shipped only). Plan marks all 42 because all are equally dead-pipe; cost is identical; future-restore correctness improves.

- [ ] **Step 4.1: Enumerate target files**

Run:
```bash
find apps/web/src/app/dashboard -path '*/_tools/use-*-tools.ts' | sort > /tmp/dead-pipe-targets.txt
wc -l /tmp/dead-pipe-targets.txt
```

Expected: ≥ 42 file paths in the list. Note exact count for verification later.

- [ ] **Step 4.2: Verify first line of each file is `"use client";`**

Run:
```bash
while IFS= read -r f; do
  first=$(head -1 "$f")
  if [ "$first" != '"use client";' ]; then
    echo "ANOMALY: $f — first line: $first"
  fi
done < /tmp/dead-pipe-targets.txt
```

Expected: zero output (no anomalies). If anomalies appear, abort and inspect — those files may have different shape and need manual marker placement.

- [ ] **Step 4.3: Insert marker line after `"use client";` in each file**

The marker text:
```
// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)
```

Run (verified-pattern sed insert, idempotent via grep guard):
```bash
MARKER='// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)'
while IFS= read -r f; do
  if grep -q "DEAD-PIPE-2026-05-14" "$f"; then
    echo "SKIP (already marked): $f"
    continue
  fi
  # Insert marker as line 2 (after "use client";), preserve original line 2+
  awk -v marker="$MARKER" 'NR==1{print; print ""; print marker; next} {print}' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  echo "MARKED: $f"
done < /tmp/dead-pipe-targets.txt
```

Expected: each line prints "MARKED: <path>"; "SKIP" only if a file already has marker (re-run safety).

- [ ] **Step 4.4: Verify markers landed on every file**

Run:
```bash
grep -l "DEAD-PIPE-2026-05-14" $(cat /tmp/dead-pipe-targets.txt) | wc -l
wc -l /tmp/dead-pipe-targets.txt
```

Expected: both counts equal (every file has marker).

- [ ] **Step 4.5: Verify typecheck still passes (markers are comments, must not break TS)**

Run:
```bash
pnpm --filter web typecheck 2>&1 | tail -20
```

Expected: exit 0 or pre-existing warnings only. If new errors appear, inspect — likely the marker insertion clobbered import lines on files that don't have `"use client";` as line 1 (Step 4.2 should have caught these; if it slipped, revert and retry).

- [ ] **Step 4.6: Spot-check 3 files visually**

Run:
```bash
head -5 apps/web/src/app/dashboard/hms/deviations/_tools/use-hms-deviations-tools.ts
head -5 apps/web/src/app/dashboard/billing/[invoice_id]/_tools/use-invoice-detail-tools.ts
head -5 apps/web/src/app/dashboard/contracts/[id]/_tools/use-contract-detail-tools.ts
```

Expected: each begins with `"use client";` then blank line then DEAD-PIPE marker.

- [ ] **Step 4.7: Commit**

```bash
git add apps/web/src/app/dashboard
git commit -m "$(cat <<'EOF'
chore(harness): mark 42 _tools/use-*-tools.ts files as DEAD-PIPE-2026-05-14

Council 2026-05-14 finding: every dashboard _tools/use-*-tools.ts file is dead-pipe
today. Client tools register correctly in browser; pipe to LLM breaks at two points
(wizard/start drops body.selected_tools; LiveKitVoiceSession.registerTool is a stub;
chat BFF has no client_tools field). See HANDOFF-2026-05-14 for full trace.

Marker text identifies the file as runtime-unconsumed until ADR-0327 (HarnessAdapter)
ships. Comments only — zero behavior change.

Scope expansion from handoff Q4: handoff defaulted to "17 dead-pipe files"
(this-session-shipped only). Marked all 42 (entire polish-wave inventory) because
defect class is identical; cost is identical; future-restore correctness improves.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Strand 1 §10 Extension — `transition-all` Blocker

**Files:**
- Modify: `.husky/pre-commit`

Add single grep line to existing §10 block. Default per handoff Q3: add `transition-all` only (lowest risk; zero false-positive surface — `transition-all` is a Tailwind class with no legitimate use case in Smartout codebase).

- [ ] **Step 5.1: Read existing §10 block to locate insertion point**

Run:
```bash
grep -n "§10\|Nordic Split\|SKIP_DESIGN_AUDIT\|transition-all" .husky/pre-commit
```

Expected: §10 starts around line 286; SKIP_DESIGN_AUDIT bypass guard present; no existing `transition-all` line.

- [ ] **Step 5.2: Read §10 block to understand pattern shape**

```bash
sed -n '286,352p' .husky/pre-commit
```

Expected: see existing palette + spring + duration grep patterns. New rule must match the shape (added-lines-only via `git diff --cached`, scoped to dashboard files, fails commit with clear message).

- [ ] **Step 5.3: Insert `transition-all` block in §10**

Add a new block within §10 (after the duration/ease block, before §10 closing). Use the same diff-only check pattern as existing rules.

Use `Edit` tool against `.husky/pre-commit`. Locate the closing of the duration/ease block (end of current §10's last rule). Insert:

```bash

# §10.4 transition-all (added 2026-05-14 — council recommendation, P2 strand 1 extension)
# Discourage transition-all in favor of explicit transition-{property} for predictable motion.
TRANS_ALL=$(git diff --cached --diff-filter=AM -U0 apps/web/src/app/dashboard 2>/dev/null \
  | grep -E '^\+' \
  | grep -v '^\+\+\+' \
  | grep -cE '\btransition-all\b' || true)

if [ "${TRANS_ALL:-0}" -gt 0 ]; then
  echo ""
  echo "❌ §10.4 blocked: $TRANS_ALL added line(s) use 'transition-all' in apps/web/src/app/dashboard/"
  echo "   Use explicit transition-{property} (transition-colors, transition-transform, etc.)"
  echo "   Bypass: SKIP_DESIGN_AUDIT=1 git commit ..."
  echo ""
  exit 1
fi
```

Place inside the existing `[ -z "$SKIP_DESIGN_AUDIT" ]` guard block so the bypass env var still works.

- [ ] **Step 5.4: Test gate fires on a contrived file**

Create a throwaway test file and stage it:

```bash
cat > /tmp/strand1-test.tsx <<'EOF'
"use client";
export default function Test() {
  return <div className="transition-all">test</div>;
}
EOF

mkdir -p apps/web/src/app/dashboard/_strand1-test
cp /tmp/strand1-test.tsx apps/web/src/app/dashboard/_strand1-test/page.tsx
git add apps/web/src/app/dashboard/_strand1-test/page.tsx

# Attempt commit — must FAIL with §10.4 message
git commit -m "test: strand 1 §10.4 — must FAIL" 2>&1 | tail -10
```

Expected: commit FAILS with "❌ §10.4 blocked: 1 added line(s) use 'transition-all'..." in output.

- [ ] **Step 5.5: Verify bypass works**

```bash
SKIP_DESIGN_AUDIT=1 git commit -m "test: strand 1 §10.4 bypass" 2>&1 | tail -5
```

Expected: commit SUCCEEDS (bypass works). Then immediately undo:

```bash
git reset --soft HEAD~1
git restore --staged apps/web/src/app/dashboard/_strand1-test/page.tsx
rm -rf apps/web/src/app/dashboard/_strand1-test/
```

Verify clean:
```bash
git status --short | grep -c "_strand1-test"
```

Expected: 0.

- [ ] **Step 5.6: Verify exec bit still intact on pre-commit (L-0266 guard)**

```bash
ls -la .husky/pre-commit | head -1
```

Expected: `-rwxr-xr-x`. If `-rw-r--r--`, run:
```bash
chmod +x .husky/pre-commit
git update-index --chmod=+x .husky/pre-commit
```

- [ ] **Step 5.7: Commit §10.4 addition**

```bash
git add .husky/pre-commit
git commit -m "$(cat <<'EOF'
feat(husky): pre-commit §10.4 — block transition-all in dashboard files

Council 2026-05-14 recommendation P2 (strand 1 extension): block transition-all
on added lines in apps/web/src/app/dashboard/ — Tailwind class with no legitimate
use case in Smartout (always prefer explicit transition-{property} for predictable
motion). Same diff-only + scope-gated + SKIP_DESIGN_AUDIT-bypass pattern as
existing §10 rules.

Tested: gate fires on contrived test file; bypass env var works.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Push + Final Verification

**Files:** None modified — verification only.

- [ ] **Step 6.1: Verify clean working tree**

Run:
```bash
git status --short
```

Expected: empty output.

- [ ] **Step 6.2: Verify 5 new commits on top of `afb94186d`**

Run:
```bash
git log --oneline afb94186d..HEAD
```

Expected: 5 commits in order (Task 1 skill demotion, Task 2 council+learnings, Task 3 ADR, Task 4 dead-pipe markers, Task 5 strand 1 §10.4). All commits with `Co-Authored-By: Claude Opus 4.7`.

- [ ] **Step 6.3: Run full pre-push typecheck guard**

```bash
pnpm --filter web typecheck 2>&1 | tail -15
```

Expected: exit 0 (or pre-existing warnings unchanged from baseline). If new errors: dead-pipe markers may have hit a file with non-`"use client";` first line — inspect and remediate.

- [ ] **Step 6.4: Push to origin/development**

```bash
git push origin development
```

Expected: push succeeds; remote updated to current HEAD. Strand 1 §10 hook fires on push (pre-push runs typecheck); the new §10.4 only fires on pre-commit so push itself doesn't re-test it.

- [ ] **Step 6.5: Verify origin/development advanced**

```bash
git log origin/development --oneline -1
git rev-parse HEAD origin/development | sort -u | wc -l
```

Expected: HEAD matches `origin/development` (last command returns 1 — same SHA).

- [ ] **Step 6.6: Append session-end note to activity-log**

Run:
```bash
~/.claude/scripts/log-activity.sh session claude "Polish-pipe-fix + skill-update P0 landed on development at $(git rev-parse --short HEAD). 5 commits: skill demotion (Phase 7/8 corrected, Phase 0/9 added, scope-naming convention to Phase 7.5 §7, 2 Common Mistakes); council log entry 2026-05-14 + L-0264/0265/0266; ADR-0327 proposed (HarnessAdapter frontmatter+context+decision); 42 _tools/use-*-tools.ts files marked DEAD-PIPE-2026-05-14; husky §10.4 transition-all block. All commits Co-Authored-By Claude Opus 4.7. Working tree clean; pushed to origin/development. Next: dedicated HarnessAdapter sortie picks up ADR-0327 body (alternatives, consequences enumerated, build phases detailed, test strategy)."
```

Expected: append succeeds, no errors. Verify with `tail -3 ~/dev/second-brain-v2/ops/activity-log.md`.

---

## Self-Review (run after writing this plan)

**1. Spec coverage:**

| Handoff item | Task covering it |
|---|---|
| Demote skill Phase 7 + Phase 8 claims | Task 1 Steps 1.2, 1.3 |
| Phase 0 pre-polish capability check addition | Task 1 Step 1.4 |
| Phase 9 mobile parity check addition | Task 1 Step 1.5 |
| Scope-naming convention added to Phase 7.5 §7 | Task 1 Step 1.6 |
| 2 new Common Mistakes (skill-claim-trace, present-tense aspirational) | Task 1 Step 1.7 |
| Council log entry for 2026-05-14 | Task 2 Step 2.1 |
| Learning 0264 skill-claim-trace-trap | Task 2 Step 2.2 |
| Learning 0265 lint-staged stash-restore | Task 2 Step 2.3 |
| Learning 0266 WSL strips exec bit | Task 2 Step 2.4 |
| ADR-0327 (proposed) — frontmatter + context + decision only | Task 3 Steps 3.3, 3.4 |
| Dead-pipe markers on _tools files | Task 4 (all 42, scope-expanded from Q4 default) |
| Strand 1 §10 extension — `transition-all` only (Q3 default) | Task 5 |
| Push to development | Task 6 Step 6.4 |
| Activity-log enrichment | Task 6 Step 6.6 |

**2. Placeholder scan:** No "TBD", "TODO", "implement later", "fill in", "appropriate", "similar to" patterns. All step content is actual command, code, or text content. Code blocks present for every code step.

**3. Type consistency:** No new types defined in this plan (annotation + documentation work only). ADR-0327 sketches an interface `HarnessAdapter` but explicitly defers full definition to dedicated sortie — consistency check N/A for this plan.

**4. Open issues:** None. Plan is self-contained.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-14-polish-pipe-fix-and-skill-update.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best fit because Tasks 1–5 are independent commits with clean boundaries.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Fits if Pontus wants to watch each commit land in real time.

**Which approach?**
