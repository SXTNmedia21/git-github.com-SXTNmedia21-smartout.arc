---
title: "Canonical ruleset disable is API PUT with enforcement=disabled — UI toggle is unreliable during recovery flows"
id: L_0196
status: accepted
layer: learning
created: 2026-05-04
updated: 2026-05-04
references:
  - ../decisions/0265-enforced-deployment-pipeline.md
  - ./0197-required-checks-pr-only-trigger-blocks-direct-push.md
---

# L-0196: Canonical ruleset disable is API PUT with enforcement=disabled — UI toggle is unreliable during recovery flows

## Why

During Scenario K (preview hard-reset to development HEAD, 2026-05-04), Pontus needed to temporarily disable ruleset 15290760 (preview branch protection) to allow a force-push. The force-push was required because preview had diverged from development via 5 squash-merge ghost commits.

First attempt: Pontus disabled the ruleset via the GitHub UI (Settings → Branches → Rulesets → enforcement toggle). The UI appeared to accept the change but the force-push was still rejected with:

```
! [remote rejected] preview (Cannot force-push to this branch)
! error: failed to push some refs to 'origin'
4 of 14 required status checks have not succeeded: 2 expected and 2 failing
```

The UI disable did not save — either a race condition in the GitHub UI, or the toggle was applied to the wrong ruleset/enforcement scope. No error was shown to the user.

Agent generated an API-based PUT command per the F2 RUNS.md pattern (F2 from 2026-05-03 had established the read-only-field strip procedure):

```bash
# Strip 8 read-only fields from GET response, set enforcement: disabled
gh api repos/SXTNmedia21/smartout.ai/rulesets/15290760 -X PUT \
  --input /tmp/preview-ruleset-disabled.json
```

The JSON body was the full ruleset from `gh api repos/SXTNmedia21/smartout.ai/rulesets/15290760` with `enforcement` changed to `"disabled"` and 8 read-only fields stripped (`_links`, `id`, `node_id`, `current_user_can_bypass`, `created_at`, `updated_at`, `source`, `source_type`).

After Pontus executed the API PUT: force-push succeeded immediately. Ruleset was re-enabled with another PUT (`enforcement: "active"`) and verified via re-fetch.

Post-K verify confirmed: preview = dev HEAD, both gaps 0, ruleset active.

## How to apply

For any operation requiring temporary ruleset disable (force-push during Scenario K, content PATCH during recovery):

1. **Do NOT use the GitHub UI toggle** — it is for inspection and permanent changes, not for state changes during time-sensitive recovery flows.
2. Use the API PUT pattern:
   ```bash
   # Step 1: fetch current ruleset and save
   gh api repos/SXTNmedia21/smartout.ai/rulesets/<ID> > /tmp/ruleset-backup.json
   
   # Step 2: build disabled body (strip read-only fields, set enforcement)
   jq 'del(._links, .id, .node_id, .current_user_can_bypass, .created_at, .updated_at, .source, .source_type) | .enforcement = "disabled"' \
     /tmp/ruleset-backup.json > /tmp/ruleset-disabled.json
   
   # Step 3: PUT
   gh api repos/SXTNmedia21/smartout.ai/rulesets/<ID> -X PUT --input /tmp/ruleset-disabled.json
   
   # Step 4: perform the force-push or content PATCH
   
   # Step 5: re-enable
   jq '.enforcement = "active"' /tmp/ruleset-disabled.json > /tmp/ruleset-enabled.json
   gh api repos/SXTNmedia21/smartout.ai/rulesets/<ID> -X PUT --input /tmp/ruleset-enabled.json
   
   # Step 6: verify
   gh api repos/SXTNmedia21/smartout.ai/rulesets/<ID> --jq '.enforcement'
   ```
3. Agent NEVER executes force-push to preview itself — generates the command, operator runs it. The ruleset PUT commands may be executed by the agent when operator has authorized the Scenario K flow.
4. Note: content edits to ruleset (adding/removing required_status_checks contexts) do NOT require `enforcement: disabled`. Only operations that violate branch protection rules (force-push, push without required checks) require disable.

Propose addition to `~/.claude/skills/deploying/SKILL.md` § Scenario K after 2nd occurrence of this pattern.

## References

- `.claude/agents/deploy-conductor/RUNS.md` — 2026-05-04 Scenario K entry, UI-disable failure documented
- `../decisions/0265-enforced-deployment-pipeline.md` — ADR governing branch protection
- `./0197-required-checks-pr-only-trigger-blocks-direct-push.md` — L-0197: related (why force-push was needed)
