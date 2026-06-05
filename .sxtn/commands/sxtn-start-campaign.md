---
name: sxtn-start-campaign
description: Start a long-lived campaign worktree — initialize campaign STATE, acquire campaign lock, update DASHBOARD, optionally trigger init-council
plugin: sxtn
plugin_version_min: "1.1"
status: active
implementation_phase: F7-W1
---

# /sxtn-start-campaign <name>

Initialize a long-lived campaign worktree. Creates the git worktree + branch, writes campaign STATE.md,
acquires campaign lock, updates DASHBOARD. Triggers `init-council` if `.sxtn/council.yaml` absent.

## Contract

Per SPEC § 6.1. See spec for full preconditions, allowed_writes, success_criteria, failure_modes.

## Required arguments

- `<campaign_name>` — kebab-case slug, `^[a-z][a-z0-9-]*$`

## Optional arguments

- `--base-branch <branch>` — base branch for campaign worktree (default: `development`)
- `--dry-run` — preview planned writes without committing

---

## Implementation guide for Claude

When Pontus invokes `/sxtn-start-campaign <name>`:

### Step 0 — Generate invocation_id

```bash
INVOCATION_ID=$(uuidgen 2>/dev/null || python3 -c 'import uuid; print(uuid.uuid4())')
START_MS=$(($(date +%s%N 2>/dev/null || echo 0) / 1000000))
```

### Step 1 — Resolve project root + load config

Walk up from `cwd` until `.sxtn/config.yaml` found. Validate via:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/bin/sxtn-validate.sh ${CLAUDE_PLUGIN_ROOT}/schemas/config.schema.json .sxtn/config.yaml
```

Extract from config:

```bash
CAMPAIGN_NAME="<from argument>"
WORKTREE_ROOT=$(awk -F': ' '/worktree_root:/{gsub(/^ +| +$/,"",$2); print $2; exit}' .sxtn/config.yaml)
CAMPAIGN_PREFIX=$(awk -F': ' '/campaign_prefix:/{gsub(/^ +| +$/,"",$2); print $2; exit}' .sxtn/config.yaml)
DASHBOARD=$(awk -F': ' '/dashboard:/{gsub(/^ +| +$/,"",$2); print $2; exit}' .sxtn/config.yaml)
DASHBOARD="${DASHBOARD:-docs/DASHBOARD.md}"
```

Failure: `.sxtn/config.yaml` absent → `F_CONFIG_MISSING`, suggest `sxtn init`, block.
Failure: validation fails → `F_CONFIG_INVALID`, surface errors, block.

### Step 2 — Validate campaign_name

Pattern: `^[a-z][a-z0-9-]*$`. Failure → block with usage message.

Reject reserved names: `campaign`, `development`, `main`, `preview`, `hotfix`.

### Step 3 — Compute paths

```
WORKTREE_PATH = $WORKTREE_ROOT/$CAMPAIGN_PREFIX$CAMPAIGN_NAME
CAMPAIGN_STATE_PATH = .sxtn/campaigns/$CAMPAIGN_NAME/STATE.md
LOCK_PATH = .sxtn/campaigns/$CAMPAIGN_NAME/.lock
BRANCH_NAME = campaign/$CAMPAIGN_NAME
```

### Step 4 — Check campaign STATE collision (resume mode)

```bash
if [[ -f "$CAMPAIGN_STATE_PATH" ]]; then
    # Resume mode — campaign already exists
    EXISTING_STATE=$(awk 'BEGIN{c=0} /^---$/{c++;next} c==1 && /^state:/{print $2; exit}' "$CAMPAIGN_STATE_PATH")

    echo "RESUME: Campaign $CAMPAIGN_NAME exists at state $EXISTING_STATE"
    # Check if worktree also exists
    if [[ -d "$WORKTREE_PATH" ]]; then
        echo "Worktree exists at $WORKTREE_PATH — resuming"
    else
        echo "WARN: campaign STATE exists but worktree missing at $WORKTREE_PATH"
        # Surface for Pontus — do not auto-recreate worktree on resume
    fi

    # Update DASHBOARD row to reconcile (not duplicate)
    bash "${CLAUDE_PLUGIN_ROOT}/bin/sxtn-dashboard-update.sh" reconcile_campaign "$DASHBOARD" "$CAMPAIGN_NAME"

    # Return ExecutionResult: status=success, summary="Resumed campaign <name>", state_before=state_after=EXISTING_STATE
    exit 0
fi
```

Critical: NEVER overwrite campaign STATE.md on resume. Read + reconcile only.

### Step 5 — Check campaign branch doesn't already exist

```bash
if git rev-parse --verify "campaign/$CAMPAIGN_NAME" >/dev/null 2>&1; then
    echo "ERROR: F_BRANCH_EXISTS — branch campaign/$CAMPAIGN_NAME already exists" >&2
    echo "Options:" >&2
    echo "  1. Re-run with a different campaign_name" >&2
    echo "  2. Delete branch manually (if orphaned): git branch -D campaign/$CAMPAIGN_NAME" >&2
    # ExecutionResult: status=blocked, errors=[{code: F_BRANCH_EXISTS}], escalate: pontus
    exit 1
fi
```

### Step 6 — Check worktree slot available

```bash
if [[ -d "$WORKTREE_PATH" ]]; then
    if git worktree list | grep -q "$WORKTREE_PATH"; then
        echo "F_WORKTREE_EXISTS — worktree already registered at $WORKTREE_PATH (no STATE.md found — inconsistent state)" >&2
        exit 1
    else
        echo "F_WORKTREE_EXISTS — directory exists at $WORKTREE_PATH but not registered as worktree" >&2
        echo "Suggestion: remove directory manually, then retry" >&2
        exit 1
    fi
fi
```

### Step 7 — If dry-run: print planned writes and exit

```bash
if [[ "${DRY_RUN:-false}" == "true" ]]; then
    echo "DRY-RUN: Would create:"
    echo "  git worktree at: $WORKTREE_PATH"
    echo "  branch: campaign/$CAMPAIGN_NAME (from ${BASE_BRANCH:-development})"
    echo "  lockfile: $LOCK_PATH"
    echo "  campaign STATE.md: $CAMPAIGN_STATE_PATH"
    echo "  DASHBOARD row (campaign): $DASHBOARD"
    # ExecutionResult: status=preview, files_written=[]
    exit 0
fi
```

### Step 8 — Create git worktree

```bash
git worktree add "$WORKTREE_PATH" -b "campaign/$CAMPAIGN_NAME" "${BASE_BRANCH:-development}"
if [[ $? -ne 0 ]]; then
    echo "ERROR: git worktree add failed" >&2
    exit 1
fi
echo "Worktree created at $WORKTREE_PATH on branch campaign/$CAMPAIGN_NAME"
```

### Step 9 — Acquire campaign lock

```bash
mkdir -p "$(dirname "$LOCK_PATH")"
bash "${CLAUDE_PLUGIN_ROOT}/bin/sxtn-lock-acquire.sh" "$LOCK_PATH" "$INVOCATION_ID" "campaign:$CAMPAIGN_NAME" "ACTIVE"
if [[ $? -ne 0 ]]; then
    echo "ERROR: F_LOCK_HELD — could not acquire campaign lock" >&2
    # Clean up worktree on lock failure
    git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || true
    git branch -D "campaign/$CAMPAIGN_NAME" 2>/dev/null || true
    exit 1
fi
```

### Step 10 — Write campaign STATE.md

```bash
CREATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
mkdir -p "$(dirname "$CAMPAIGN_STATE_PATH")"

cat > "$CAMPAIGN_STATE_PATH" <<EOF
---
campaign: ${CAMPAIGN_NAME}
state: ACTIVE
worktree: ${WORKTREE_PATH}
branch: campaign/${CAMPAIGN_NAME}
base_branch: ${BASE_BRANCH:-development}
created_at: ${CREATED_AT}
updated_at: ${CREATED_AT}
sorties: []
closed_sorties: []
open_questions: 0
invocation_id: ${INVOCATION_ID}
---

# Campaign STATE — ${CAMPAIGN_NAME}

> Plugin-managed file. Only sxtn-state skill writes here. Manual edits will be overwritten.

## Active sorties

(empty — populated as sub-sorties are started via /sxtn-start-feature inside campaign worktree)

## Closed sorties

(empty — populated as sub-sorties reach S9)

## Campaign notes

(populated via /sxtn-end-session inside campaign)

## Open Pontus pings

(empty — populated at G8 or T4)
EOF

echo "Campaign STATE written: $CAMPAIGN_STATE_PATH"
```

Validate written STATE:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/bin/sxtn-validate.sh" "${CLAUDE_PLUGIN_ROOT}/schemas/state.schema.json" "$CAMPAIGN_STATE_PATH" 2>/dev/null || {
    echo "WARN: Campaign STATE did not fully validate against state.schema.json (campaign format variant)" >&2
}
```

### Step 11 — Update DASHBOARD

```bash
bash "${CLAUDE_PLUGIN_ROOT}/bin/sxtn-dashboard-update.sh" add_campaign "$DASHBOARD" \
    "$CAMPAIGN_NAME" "$WORKTREE_PATH" "campaign/$CAMPAIGN_NAME" "ACTIVE" "$INVOCATION_ID"
```

### Step 12 — Init council if no council.yaml

```bash
if [[ ! -f ".sxtn/council.yaml" ]]; then
    echo "INFO: .sxtn/council.yaml absent — triggering init-council skill"
    # Invoke init-council skill via Skill tool
    # init-council will write .sxtn/council.yaml
    # If init-council not available: emit warning, continue (council triggers fire at G3/G4/G6 not at start-campaign)
    echo "WARN: init-council deferred — run /sxtn-start-feature inside campaign to trigger at G3" >&2
fi
```

### Step 13 — Activity log entry

```bash
LOG_SCRIPT=$(awk -F': ' '/log_script:/{gsub(/^ +| +$/,"",$2); print $2; exit}' .sxtn/config.yaml 2>/dev/null)
if [[ -n "$LOG_SCRIPT" && -f "$LOG_SCRIPT" ]]; then
    bash "$LOG_SCRIPT" session claude "/sxtn-start-campaign $CAMPAIGN_NAME — ACTIVE, worktree $WORKTREE_PATH" 2>/dev/null || true
fi
```

### Step 14 — Release lock (campaign holds open lock during lifecycle; do NOT release here)

Campaign lock is held until `/sxtn-close-campaign` releases it. Unlike sortie locks, campaign lock
persists across sessions. Heartbeat updates prevent stale-lock false positives.

### Step 15 — Return ExecutionResult

```yaml
status: success
command_or_skill: sxtn-start-campaign
invocation_id: <UUID>
summary: "Started campaign <name> — ACTIVE, worktree <path>"
inputs:
  campaign_name: <name>
  base_branch: <branch>
  dry_run: false
files_read:
  - .sxtn/config.yaml
  - docs/DASHBOARD.md
files_written:
  - .sxtn/campaigns/<name>/STATE.md
  - .sxtn/campaigns/<name>/.lock
  - docs/DASHBOARD.md
files_blocked: []
validation_results:
  schema:
    - name: config.schema.json
      result: pass
state_before:
  state: null
state_after:
  state: ACTIVE
next_recommended_action: "cd <worktree_path> and run /sxtn-start-feature <sub-feature-name> to begin first sub-sortie"
evidence:
  activity_log_entry: <log line or null>
errors: []
retry_count: 0
duration_ms: <measured>
```

---

## Failure handling

| Code                | Action                                             |
| ------------------- | -------------------------------------------------- |
| `F_CONFIG_MISSING`  | Surface "run sxtn init"; block                     |
| `F_CONFIG_INVALID`  | Surface repair patch; block                        |
| `F_BRANCH_EXISTS`   | Abort with rename/delete proposal; escalate Pontus |
| `F_WORKTREE_EXISTS` | Abort; surface path; manual cleanup required       |
| `F_LOCK_HELD`       | Abort; surface owner + age                         |

---

## Idempotency

- If `campaign STATE.md` exists → resume mode (read + reconcile, never overwrite)
- DASHBOARD row updated in place (never duplicated)
- Campaign lock held open across sessions; heartbeat prevents stale detection

---

## Dry-run

`--dry-run` performs all validations and precondition checks. Prints planned writes to stdout.
No git worktree creation, no STATE.md write, no DASHBOARD update, no lock acquire.
Returns `ExecutionResult.status = "preview"` with `files_written: []`.
