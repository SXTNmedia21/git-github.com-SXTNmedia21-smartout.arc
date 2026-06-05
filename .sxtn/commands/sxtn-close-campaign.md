---
name: sxtn-close-campaign
description: Retire a long-lived campaign — cross-sortie LESSONS synthesis, member-graduation review via retro-council, archive STATE → _CLOSED.md, mark DASHBOARD row RETIRED (worktree preserved per ADR-0213)
plugin: sxtn
plugin_version_min: "1.1"
status: active
implementation_phase: F7-W1
---

# /sxtn-close-campaign <name>

Retire a long-lived campaign. Synthesizes LESSONS across all sorties, runs retro-council
member-graduation review, archives campaign STATE to `_CLOSED.md`, marks DASHBOARD row RETIRED.

Worktree and campaign branch are preserved (SPEC § 6.1 forbidden_writes + plugin § 14 ADR-0213
ancestry rule). Do NOT run this command to "clean up" — only run when campaign is genuinely complete.

## Contract

Per SPEC § 6.1. See spec for full preconditions, allowed_writes, success_criteria, failure_modes.

## Required arguments

- `<campaign_name>` — kebab-case slug matching an active campaign

## Optional arguments

- `--dry-run` — preview all planned writes + LESSONS synthesis without committing

---

## Implementation guide for Claude

When Pontus invokes `/sxtn-close-campaign <name>`:

### Step 0 — Generate invocation_id

```bash
INVOCATION_ID=$(uuidgen 2>/dev/null || python3 -c 'import uuid; print(uuid.uuid4())')
START_MS=$(($(date +%s%N 2>/dev/null || echo 0) / 1000000))
```

### Step 1 — Resolve project root + load config

Walk up from `cwd` until `.sxtn/config.yaml` found.

```bash
CAMPAIGN_NAME="<from argument>"
CAMPAIGN_STATE_PATH=".sxtn/campaigns/$CAMPAIGN_NAME/STATE.md"
LOCK_PATH=".sxtn/campaigns/$CAMPAIGN_NAME/.lock"

DOMAIN_ROOT=$(awk -F': ' '/domain_root:/{gsub(/^ +| +$/,"",$2); print $2; exit}' .sxtn/config.yaml)
DOMAIN_ROOT="${DOMAIN_ROOT:-docs/domains}"
DASHBOARD=$(awk -F': ' '/dashboard:/{gsub(/^ +| +$/,"",$2); print $2; exit}' .sxtn/config.yaml)
DASHBOARD="${DASHBOARD:-docs/DASHBOARD.md}"
```

### Step 2 — Verify campaign STATE.md exists

```bash
if [[ ! -f "$CAMPAIGN_STATE_PATH" ]]; then
    echo "ERROR: F_STATE_MISSING — campaign STATE.md not found at $CAMPAIGN_STATE_PATH" >&2
    echo "Run /sxtn-start-campaign $CAMPAIGN_NAME first" >&2
    exit 1
fi

CURRENT_CAMPAIGN_STATE=$(awk 'BEGIN{c=0} /^---$/{c++;next} c==1 && /^state:/{print $2; exit}' "$CAMPAIGN_STATE_PATH")

if [[ "$CURRENT_CAMPAIGN_STATE" == "RETIRED" ]]; then
    echo "INFO: Campaign $CAMPAIGN_NAME already RETIRED — close is idempotent no-op" >&2
    # ExecutionResult: status=success, summary="Campaign already RETIRED (idempotent no-op)"
    exit 0
fi
```

### Step 3 — Verify lock owned by caller (or acquire if absent)

```bash
LOCK_STATUS=$(bash "${CLAUDE_PLUGIN_ROOT}/bin/sxtn-lock-check.sh" "$LOCK_PATH" "$INVOCATION_ID" 2>/dev/null || echo '{"kind":"missing"}')
LOCK_KIND=$(echo "$LOCK_STATUS" | jq -r '.kind // "missing"')

case "$LOCK_KIND" in
    "missing")
        # Acquire on-the-fly (campaign lock may have lapsed between sessions)
        bash "${CLAUDE_PLUGIN_ROOT}/bin/sxtn-lock-acquire.sh" "$LOCK_PATH" "$INVOCATION_ID" "campaign:$CAMPAIGN_NAME" "CLOSING" >/dev/null 2>&1 || {
            echo "ERROR: F_LOCK_HELD — lock missing and re-acquire failed" >&2
            exit 1
        }
        ;;
    "held_by_other")
        STALE=$(echo "$LOCK_STATUS" | jq -r '.stale // false')
        if [[ "$STALE" == "true" ]]; then
            echo "WARN: Lock held by other orchestrator (>24h, stale). Requires Pontus confirmation to break." >&2
            # ExecutionResult: status=blocked, errors=[{code: F_LOCK_HELD}], escalate: pontus
        else
            echo "ERROR: F_LOCK_HELD — active lock held by different orchestrator" >&2
        fi
        exit 1
        ;;
    "held_by_self"|"available")
        # OK
        ;;
esac
```

### Step 4 — Verify all sorties in campaign are closed (state=S9)

```bash
OPEN_SORTIES=()

# Find all STATE.md files under domain_root that reference this campaign
while IFS= read -r -d '' candidate; do
    CANDIDATE_CAMPAIGN=$(awk 'BEGIN{c=0} /^---$/{c++;next} c==1 && /^campaign:/{print $2; exit}' "$candidate" 2>/dev/null)
    CANDIDATE_STATE=$(awk 'BEGIN{c=0} /^---$/{c++;next} c==1 && /^state:/{print $2; exit}' "$candidate" 2>/dev/null)

    if [[ "$CANDIDATE_CAMPAIGN" == "$CAMPAIGN_NAME" && "$CANDIDATE_STATE" != "S9" && -n "$CANDIDATE_STATE" ]]; then
        SORTIE=$(awk 'BEGIN{c=0} /^---$/{c++;next} c==1 && /^sortie:/{print $2; exit}' "$candidate" 2>/dev/null)
        OPEN_SORTIES+=("${SORTIE:-$candidate} (state: $CANDIDATE_STATE)")
    fi
done < <(find "$DOMAIN_ROOT" -name "STATE.md" -print0 2>/dev/null)

if [[ ${#OPEN_SORTIES[@]} -gt 0 ]]; then
    echo "ERROR: F_OPEN_FEATURES — ${#OPEN_SORTIES[@]} sortie(s) not yet S9:" >&2
    printf '  - %s\n' "${OPEN_SORTIES[@]}" >&2
    echo "Close all sorties with /sxtn-close-feature before closing campaign." >&2
    # ExecutionResult: status=blocked, errors=[{code: F_OPEN_FEATURES, message: "..."}]
    exit 1
fi

echo "All sorties verified S9 — proceeding with campaign closure"
```

### Step 5 — If dry-run: print planned writes and exit

```bash
if [[ "${DRY_RUN:-false}" == "true" ]]; then
    echo "DRY-RUN: Would write:"
    echo "  Cross-sortie LESSONS synthesis (in campaign STATE)"
    echo "  docs/domains/<d>/_CLOSED.md — campaign archive"
    echo "  .sxtn/campaigns/$CAMPAIGN_NAME/STATE.md — state=RETIRED"
    echo "  $DASHBOARD — mark campaign row RETIRED"
    echo "  Activity log entry"
    echo "DRY-RUN: Would NOT:"
    echo "  Delete worktree (preserved per ADR-0213)"
    echo "  Delete campaign branch (preserved per ADR-0213)"
    # ExecutionResult: status=preview, files_written=[]
    exit 0
fi
```

### Step 6 — Cross-sortie LESSONS synthesis

```bash
LESSONS_PATHS=()
while IFS= read -r -d '' lf; do
    LESSONS_PATHS+=("$lf")
done < <(find "$DOMAIN_ROOT" -name "LESSONS-*.md" -print0 2>/dev/null | sort -z)

SYNTHESIS_TS=$(date -u +%Y-%m-%dT%H%M%SZ)
SYNTHESIS_PATH=".sxtn/campaigns/$CAMPAIGN_NAME/LESSONS-CAMPAIGN-${CAMPAIGN_NAME}-${SYNTHESIS_TS}.md"

# Count LESSONS files across all campaign sorties
CAMPAIGN_LESSONS_COUNT=0
for lf in "${LESSONS_PATHS[@]}"; do
    # Check if this LESSONS file belongs to a sortie in our campaign
    LESSONS_DIR=$(dirname "$lf")
    STATE_FOR_LESSONS=$(find "$LESSONS_DIR/.." -name "STATE.md" -print -quit 2>/dev/null)
    if [[ -n "$STATE_FOR_LESSONS" ]]; then
        CAM=$(awk 'BEGIN{c=0} /^---$/{c++;next} c==1 && /^campaign:/{print $2; exit}' "$STATE_FOR_LESSONS" 2>/dev/null)
        if [[ "$CAM" == "$CAMPAIGN_NAME" ]]; then
            CAMPAIGN_LESSONS_COUNT=$((CAMPAIGN_LESSONS_COUNT + 1))
        fi
    fi
done

mkdir -p "$(dirname "$SYNTHESIS_PATH")"
cat > "$SYNTHESIS_PATH" <<EOF
---
title: LESSONS SYNTHESIS — Campaign ${CAMPAIGN_NAME}
status: captured
campaign: ${CAMPAIGN_NAME}
created_at: ${SYNTHESIS_TS}
lessons_files_scanned: ${CAMPAIGN_LESSONS_COUNT}
synthesized_by: sxtn-orchestrator / sxtn-close-campaign
---

# LESSONS SYNTHESIS — Campaign ${CAMPAIGN_NAME}

> Cross-sortie lesson synthesis. Generated at campaign closure.

## Campaign summary

- Campaign name: ${CAMPAIGN_NAME}
- Closed at: ${SYNTHESIS_TS}
- Sorties captured: ${CAMPAIGN_LESSONS_COUNT}

## Recurring patterns

(To be populated by retro-council)

## Member graduation candidates

(Populated by retro-council — members with 0 contributions over 5+ sorties)

## Lessons by category

### Autonomy / gate handling

(Patterns from gate FAIL → PASS transitions across sorties)

### Subagent reliability

(Patterns from subagent retries, fabrication catches)

### Council efficiency

(Council REJECT patterns, loop-cap encounters)

## Promoted to plugin (if 3-occurrence threshold reached)

(See sxtn-promote-lesson output)
EOF

echo "Cross-sortie LESSONS synthesis written: $SYNTHESIS_PATH"
```

### Step 7 — Invoke retro-council skill (member-graduation review)

```bash
# Invoke retro-council skill via Skill tool
# retro-council reads: campaign STATE.md + all LESSONS files + council.yaml
# retro-council proposes: member additions/removals/model upgrades
# retro-council writes: report to .sxtn/campaigns/<name>/COUNCIL-retro-<ts>.md
# retro-council proposes changes via PR — never direct-writes council.yaml

echo "INFO: Dispatching retro-council for campaign $CAMPAIGN_NAME"

RETRO_REPORT_PATH=".sxtn/campaigns/$CAMPAIGN_NAME/COUNCIL-retro-${SYNTHESIS_TS}.md"
# Skill invocation: retro-council(context=campaign, campaign=$CAMPAIGN_NAME, lessons_path=$SYNTHESIS_PATH)
# Expected output: council report at $RETRO_REPORT_PATH
# Verdict: APPROVE | APPROVE-WITH-CHANGES | REJECT
RETRO_VERDICT="APPROVE"  # placeholder; real value from retro-council ExecutionResult

if [[ "$RETRO_VERDICT" == "REJECT" ]]; then
    echo "ERROR: F_COUNCIL_REJECT — retro-council rejected campaign closure" >&2
    echo "Review retro-council report at $RETRO_REPORT_PATH for required changes" >&2
    # ExecutionResult: status=blocked, errors=[{code: F_COUNCIL_REJECT}]
    exit 1
fi

echo "retro-council verdict: $RETRO_VERDICT"
```

### Step 8 — Write \_CLOSED.md archive

Archive path: the first domain used by this campaign, or `.sxtn/campaigns/<name>/` if no domain detected.

```bash
CLOSED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Determine archive path
# Primary: docs/domains/<primary_domain>/_CLOSED.md
# Fallback: .sxtn/campaigns/<name>/ARCHIVE.md
ARCHIVE_PATH=".sxtn/campaigns/$CAMPAIGN_NAME/ARCHIVE.md"

# Check idempotency: skip if _CLOSED.md already exists for this campaign
if [[ -f "$ARCHIVE_PATH" ]]; then
    echo "INFO: Archive already exists at $ARCHIVE_PATH — skipping write (idempotent)" >&2
else
    WORKTREE_PATH=$(awk 'BEGIN{c=0} /^---$/{c++;next} c==1 && /^worktree:/{print $2; exit}' "$CAMPAIGN_STATE_PATH" 2>/dev/null)
    BRANCH_NAME=$(awk 'BEGIN{c=0} /^---$/{c++;next} c==1 && /^branch:/{print $2; exit}' "$CAMPAIGN_STATE_PATH" 2>/dev/null)

    cat > "$ARCHIVE_PATH" <<EOF
---
title: CAMPAIGN ARCHIVE — ${CAMPAIGN_NAME}
status: retired
campaign: ${CAMPAIGN_NAME}
created_at: $(awk 'BEGIN{c=0} /^---$/{c++;next} c==1 && /^created_at:/{print $2; exit}' "$CAMPAIGN_STATE_PATH" 2>/dev/null)
closed_at: ${CLOSED_AT}
worktree: ${WORKTREE_PATH}
branch: ${BRANCH_NAME}
sorties_closed: ${CAMPAIGN_LESSONS_COUNT}
council_retro: ${RETRO_REPORT_PATH}
lessons_synthesis: ${SYNTHESIS_PATH}
---

# Campaign Archive — ${CAMPAIGN_NAME}

> Generated at campaign closure. Worktree and branch preserved per plugin § 14 (ADR-0213 ancestry rule).
> Branch: ${BRANCH_NAME:-unknown}
> Worktree: ${WORKTREE_PATH:-unknown} (preserved — do NOT delete)

## What was built

(Summarized from sorties)

## Key decisions

(Cross-reference docs/decisions/ for ADRs written during campaign)

## Performance summary

- Sorties closed at S9: ${CAMPAIGN_LESSONS_COUNT}
- Council consults: (from retro-council report)
- Pontus pings: (from STATE.md)
- Pattern promotions: (from sxtn-promote-lesson)

## Next steps

(Suggested by retro-council)
EOF

    echo "Campaign archive written: $ARCHIVE_PATH"
fi
```

### Step 9 — Advance campaign STATE to RETIRED

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

TMP_STATE=$(mktemp)
trap 'rm -f "$TMP_STATE"' EXIT

awk -v now="$NOW" '
BEGIN { in_front=0; front_count=0; state_done=0; updated_done=0; closed_done=0 }
/^---$/ {
    front_count++
    if (front_count == 1) { in_front=1; print; next }
    if (front_count == 2) { in_front=0 }
}
in_front && /^state:/ { print "state: RETIRED"; state_done=1; next }
in_front && /^updated_at:/ { print "updated_at: " now; updated_done=1; next }
in_front && /^closed_at:/ { print "closed_at: " now; closed_done=1; next }
{ print }
END {
    if (!closed_done && in_front) print "closed_at: " now
}
' "$CAMPAIGN_STATE_PATH" > "$TMP_STATE"

cp "$TMP_STATE" "$CAMPAIGN_STATE_PATH"
trap - EXIT
rm -f "$TMP_STATE"

echo "Campaign STATE advanced to RETIRED"
```

### Step 10 — Update DASHBOARD row to RETIRED (keep row — do not remove)

```bash
if [[ -f "$DASHBOARD" ]]; then
    bash "${CLAUDE_PLUGIN_ROOT}/bin/sxtn-dashboard-update.sh" retire_campaign "$DASHBOARD" "$CAMPAIGN_NAME" 2>/dev/null || {
        echo "WARN: DASHBOARD retire_campaign returned non-zero — row may already be RETIRED" >&2
    }
    echo "DASHBOARD row marked RETIRED for campaign $CAMPAIGN_NAME"
else
    echo "WARN: DASHBOARD not found at $DASHBOARD" >&2
fi
```

**Critical:** Campaign rows are NEVER removed from DASHBOARD. Mark as RETIRED, preserve for audit trail.
This is different from sortie rows (which are removed at S9).

### Step 11 — DO NOT delete worktree or branch

Per SPEC § 6.1 forbidden_writes + plugin § 14 (ADR-0213 ancestry rule):

```
# NEVER run:
# git worktree remove <campaign_worktree>
# git branch -D campaign/<name>
#
# Campaigns are long-lived. Worktree and branch must be preserved
# for git blame, ancestry tracking, and forensic reference.
# Recovery after accidental deletion is project-owner responsibility.
```

### Step 12 — Trigger claude-mem digest

```bash
CLAUDE_MEM_OK="${CLAUDE_MEM_AVAILABLE:-0}"
if [[ "$CLAUDE_MEM_OK" == "1" ]]; then
    echo "INFO: claude-mem digest triggered (orchestrator invokes MCP tool from session context)" >&2
else
    echo "WARN: F_CLAUDE_MEM_UNREACHABLE — digest skipped; non-blocking" >&2
fi
```

### Step 13 — Activity log entry

```bash
LOG_SCRIPT=$(awk -F': ' '/log_script:/{gsub(/^ +| +$/,"",$2); print $2; exit}' .sxtn/config.yaml 2>/dev/null)
if [[ -n "$LOG_SCRIPT" && -f "$LOG_SCRIPT" ]]; then
    bash "$LOG_SCRIPT" session claude "/sxtn-close-campaign $CAMPAIGN_NAME — RETIRED, ${CAMPAIGN_LESSONS_COUNT} sorties closed" 2>/dev/null || true
fi
```

### Step 14 — Release lockfile

```bash
bash "${CLAUDE_PLUGIN_ROOT}/bin/sxtn-lock-release.sh" "$LOCK_PATH" "$INVOCATION_ID" 2>/dev/null || {
    echo "WARN: lock release returned non-zero; may already be released" >&2
}
echo "Campaign lockfile released"
```

### Step 15 — Return ExecutionResult

```yaml
status: success
command_or_skill: sxtn-close-campaign
invocation_id: <UUID>
summary: "Retired campaign <name> — RETIRED, <N> sorties synthesized, archive written"
inputs:
  campaign_name: <name>
  dry_run: false
files_read:
  - .sxtn/campaigns/<name>/STATE.md
  - .sxtn/config.yaml
  - docs/domains/**/<f>/STATE.md  (all campaign sorties)
  - docs/domains/**/<f>/reports/LESSONS-*.md  (all campaign LESSONS)
files_written:
  - .sxtn/campaigns/<name>/LESSONS-CAMPAIGN-<name>-<ts>.md
  - .sxtn/campaigns/<name>/COUNCIL-retro-<ts>.md
  - .sxtn/campaigns/<name>/ARCHIVE.md
  - .sxtn/campaigns/<name>/STATE.md (state=RETIRED)
  - docs/DASHBOARD.md (row marked RETIRED, NOT removed)
files_blocked:
  - .sxtn/campaigns/<name>/worktree  (preserved per ADR-0213)
  - git branch campaign/<name>       (preserved per ADR-0213)
validation_results:
  schema: []
  gate:
    gate: CAMPAIGN-CLOSE
    result: PASS
state_before:
  state: ACTIVE
state_after:
  state: RETIRED
  closed_at: <ISO-8601>
next_recommended_action: "Campaign RETIRED. Worktree + branch preserved. Run /sxtn-status to confirm DASHBOARD."
evidence:
  council_report: .sxtn/campaigns/<name>/COUNCIL-retro-<ts>.md
  activity_log_entry: <log line or null>
errors:
  - code: F_CLAUDE_MEM_UNREACHABLE
    message: "claude-mem digest skipped"
    recoverable: true
retry_count: 0
duration_ms: <measured>
```

---

## Failure handling

| Code                       | Action                                                 |
| -------------------------- | ------------------------------------------------------ |
| `F_CONFIG_MISSING`         | Surface "run sxtn init"; block                         |
| `F_STATE_MISSING`          | Campaign STATE.md not found; block                     |
| `F_OPEN_FEATURES`          | List non-S9 sorties; block until all closed            |
| `F_LOCK_HELD`              | Abort; surface owner + age; if >24h escalate Pontus    |
| `F_COUNCIL_REJECT`         | Apply retro-council changes if concrete; else escalate |
| `F_CLAUDE_MEM_UNREACHABLE` | Log warning; continue (non-blocking)                   |

---

## Idempotency

- If campaign STATE already RETIRED → returns success immediately (no-op message)
- Archive write skipped if `ARCHIVE.md` already exists for same campaign
- DASHBOARD `retire_campaign` is idempotent (no-op if already RETIRED)
- LESSONS synthesis does not overwrite existing synthesis (timestamp suffix)

---

## Dry-run

`--dry-run` performs all validations (config, campaign STATE, lock, open sorties check).
Prints planned synthesis + archive writes without any STATE mutations.
Returns `ExecutionResult.status = "preview"` with `files_written: []`.

---

## Hard constraints (never bypass)

1. Never delete campaign worktree — SPEC § 6.1 forbidden_writes
2. Never delete campaign branch — SPEC § 6.1 forbidden_writes + plugin § 14 (ADR-0213)
3. Never remove DASHBOARD campaign row — mark RETIRED, keep for audit trail
4. Never close campaign while any sortie is not S9 — `F_OPEN_FEATURES` blocks unconditionally
5. Never skip retro-council — member graduation review is required for proper lesson synthesis
