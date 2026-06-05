---
title: Drift Risk — Implementation Plan
status: draft
updated: 2026-05-06
created: 2026-05-06
module: payroll
tags: [payroll, drift, schema-sync, audit, prevention, ci]
---

# Drift Prevention Plan — Payroll Module + Future Sorties

> Cascade-audit 2026-05-06 fant 8 RED finds — 5 av dem var schema-drift (docs claimer ikke-eksisterende tabeller/kolonner). Drift-mønsteret er recurring (L-0098 staleness). Denne planen sikrer at det ikke skjer igjen.

## 1. Risk Inventory — Hva drifter

| Drift-klasse | Eksempel fra audit | Severity | Detection cost | Recovery cost |
|---|---|---|---|---|
| **Phantom table** — doc refererer tabel som ikke finnes | R1: `shift_pay_calculation_event` | HØY | LAV (1 grep) | MEDIUM (re-spec eller ADR-promote) |
| **Phantom column** — doc refererer kolonne som ikke finnes | R8: `payroll.calculation.provenance`, Y2: `weekend_cost` | HØY | LAV (grep) | MEDIUM (migration) |
| **Wrong table name** — `payroll.payroll_*` istedenfor `payroll.*` | Y1: 31 forekomster | MEDIUM | LAV (regex) | LAV (find-replace) |
| **Wrong enum name/values** — `rule_severity=(warn,error)` istedenfor `(block,warn)` | DATA-MODEL §5 | MEDIUM | LAV (compare) | LAV (edit doc) |
| **Schema mismatch** — eksisterende tabel har annen struktur enn doc claim | R2: `timebank_entry` mangler account_type | HØY | MEDIUM (read schema) | HØY (re-design) |
| **ADR-status drift** — doc bygger på `proposed` ADR som om den er `accepted` | R6: ADR-0250/0251 | HØY | MEDIUM (cross-ref) | HØY (promote eller scope-out) |
| **Bootstrap-bypass** — schema-fields finnes men I1 seeder ikke dem | R5: 19 nye workspace_settings fields | MEDIUM | MEDIUM (compare bootstrap-template) | MEDIUM (update bootstrap) |
| **Code-call drift** — doc beskriver flow som koden ikke gjør | (ikke i denne audit, men kjent) | HØY | HØY (read code) | HØY (rewrite eller fix code) |

---

## 2. Drift Classes & Detection Strategies

### Class A — Schema-doc drift (most common)

**Signal:** Doc nevner tabel/kolonne/enum/value. Schema mangler det.

**Detect:** Static grep mot `packages/supabase/src/database.types.ts`.

**Prevention gate:** Pre-merge CI step som leser doc + cross-ref schema.

### Class B — ADR-status drift

**Signal:** Doc behandler `proposed` ADR som om den er `accepted`.

**Detect:** Parse ADR frontmatter `status:`; cross-ref med docs som siterer ADR.

**Prevention gate:** ADR-promote checklist krever doc-update sweep.

### Class C — Code-vs-doc drift

**Signal:** Doc beskriver function-signatur som ikke matcher kode.

**Detect:** Targeted grep + manual review.

**Prevention gate:** Plan-vs-code verification i sortie-spec (system-steward Day 8).

### Class D — Bootstrap-bypass drift

**Signal:** Schema har felt; I1 hospitality-package + `_apply.sql` mangler dem.

**Detect:** Diff mot `packages/ai/src/industry/packages/hospitality.ts` + `supabase/templates/restaurant/_apply.sql`.

**Prevention gate:** Migration-PR template krever bootstrap-checklist.

---

## 3. Detection Layer — Three-Tier System

### Tier 1: Automated CI gate (per PR)

**Tool:** New script `infra/scripts/check-doc-schema-drift.sh`

**Behavior:**
1. Find all `*.md` files in `docs/modules/`, `docs/architecture/`
2. Extract schema-claims via regex:
   - `payroll\.[a-z_]+` → table refs
   - `public\.[a-z_]+` → table refs
   - `\.[a-z_]+ (TEXT|UUID|INT|NUMERIC|TIMESTAMPTZ|JSONB|BOOLEAN|DATE)` → column refs in code blocks
3. Cross-ref against `packages/supabase/src/database.types.ts`
4. Output: list of phantom refs

**Trigger:** GitHub Action `doc-schema-drift.yml` on PR-open + push to `feat/*`.

**Block:** PR cannot merge to `development` if drift found (severity error).

**Implementation:** ~1 dag build. Script uses `jq` + `grep`.

### Tier 2: Heartbeat scheduled audit (weekly)

**Tool:** New heartbeat job `doc-schema-audit.sh`

**Behavior:**
- Run Tier 1 across ALL docs (not just changed)
- Generate report `ops/reports/YYYY-MM-DD-doc-schema-audit.md`
- Telegram alert if drift count increases week-over-week

**Trigger:** Weekly via heartbeat. Cooldown: 7 dager.

**Add to:** `~/dev/second-brain-v2/HEARTBEAT.md`.

**Implementation:** ~2 timer. Reuses Tier 1 script.

### Tier 3: Sortie pre-flight verification (per sortie)

**Tool:** Existing `system-steward` (opus) agent + cascade-audit checklist

**Behavior:** Pre-Day-1 audit per ny sortie:
1. Run Tier 1 script på sortie-spec docs
2. Cross-check ADR statuses
3. Verify I1-bootstrap-coverage for new schema fields
4. Output: GO / GO-WITH-FIXES / NO-GO verdict

**Trigger:** Manual før sortie-kick-off. Must run.

**Add to:** Every sortie-spec template Pre-Flight Blockers section.

**Implementation:** ~30 min per sortie (one-time agent run).

---

## 4. Prevention Gates — Sortie Workflow

### Gate G1: Sortie-spec writing time

**Rule:** Every schema-claim in sortie-spec MUST cite source.

**Format:**
```markdown
## Schema reference

> Verified against `packages/supabase/src/database.types.ts` 2026-05-06.

`payroll.calculation` columns: ...
```

**Author responsibility:** Sortie-author runs Tier 1 script before publishing spec.

**Enforcement:** PR review.

### Gate G2: ADR promote-to-accepted

**Rule:** When `status: proposed` → `status: accepted`, author MUST sweep all docs that reference the ADR and remove "(proposed)" qualifiers.

**Checklist (added to ADR template):**
- [ ] grep'd all docs for ADR-XXXX references
- [ ] Updated each from "(proposed)" → "(accepted YYYY-MM-DD)"
- [ ] Migration committed if ADR introduces schema change
- [ ] I1 bootstrap updated if ADR adds workspace_settings fields

**Enforcement:** PR template + manual review.

### Gate G3: Migration-PR

**Rule:** PR introducing migration MUST update:
1. `database.types.ts` (regenerate)
2. I1 hospitality-package if workspace_settings changed
3. `_apply.sql` template if new tables created with workspace-scope
4. Module docs if module's schema-section affected

**Checklist (added to PR template):**
- [ ] `pnpm supabase:types` ran
- [ ] `database.types.ts` diff committed
- [ ] I1 bootstrap coverage verified for new fields
- [ ] All affected module docs updated

**Enforcement:** CI script verifies (1) + (2). Manual review for (3) + (4).

### Gate G4: Plan-vs-code verification (sortie-close)

**Rule:** Day 8 acceptance MUST include `system-steward` verification step.

**Behavior:** Re-run Tier 1 script + ADR-status check after sortie work. Diff against pre-Day-1 baseline. Any new drift introduced during build → BLOCK close-feature.

**Enforcement:** Existing close-feature.sh extended.

---

## 5. Recovery Procedure — When Drift Is Found

### Step 1: Classify

Run script:
```bash
./infra/scripts/check-doc-schema-drift.sh --classify
```

Output assigns each drift to Class A–D.

### Step 2: Triage by class

| Class | Recovery |
|---|---|
| A — phantom column/table | Decide: add migration OR remove doc-claim. Update OPEN-QUESTIONS.md as `O##` blocker. |
| B — ADR-status | Promote ADR OR scope-out doc-claim. |
| C — code-vs-doc | Read code; either fix code or fix doc. |
| D — bootstrap-bypass | Update I1 hospitality-package + `_apply.sql`. Day 0.5 task. |

### Step 3: Apply recovery

For each drift:
1. Document in OPEN-QUESTIONS.md if blocking
2. Track in module audit-doc (`AUDIT-CASCADE-YYYY-MM-DD.md`)
3. Land fix as separate commit (don't bundle)

### Step 4: Verify

Re-run Tier 1 script. Drift count must be 0 before close-feature.

---

## 6. Tooling

### Script: `infra/scripts/check-doc-schema-drift.sh`

```bash
#!/usr/bin/env bash
# Drift-detection: cross-ref docs vs database.types.ts
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
TYPES="$ROOT/packages/supabase/src/database.types.ts"
SCOPE="${1:-docs/modules}"

# Extract schema names from types file
TABLES=$(awk '/Tables: \{/,/Views: \{/' "$TYPES" | grep -oE '^      [a-z_]+:' | sed 's/[: ]//g' | sort -u)

# Find table refs in docs
REFS=$(grep -rohE '`(payroll|public|timesheet|websites)\.[a-z_]+`' "$ROOT/$SCOPE" | sed 's/`//g' | sort -u)

DRIFT_COUNT=0
for REF in $REFS; do
  TABLE=$(echo "$REF" | sed 's/^[a-z_]*\.//')
  if ! echo "$TABLES" | grep -q "^$TABLE$"; then
    echo "PHANTOM: $REF"
    DRIFT_COUNT=$((DRIFT_COUNT + 1))
  fi
done

if [ "$DRIFT_COUNT" -gt 0 ]; then
  echo "FAIL: $DRIFT_COUNT drift refs found"
  exit 1
fi
echo "PASS: 0 drift refs"
```

**Limitations:** Only catches Class A (table-name drift). Class B + C + D require additional tooling.

### Script: `infra/scripts/check-adr-status-drift.sh`

```bash
#!/usr/bin/env bash
# Find docs that cite ADR-XXXX as if accepted, but ADR is proposed
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"

# Find proposed ADRs
PROPOSED=$(grep -lE "^status: proposed" "$ROOT/docs/decisions/"*.md | xargs -I {} basename {} .md | grep -oE "^[0-9]+")

DRIFT=0
for ADR in $PROPOSED; do
  # Find non-decision-log refs
  REFS=$(grep -rln "ADR-$ADR" "$ROOT/docs/modules/" "$ROOT/docs/architecture/" 2>/dev/null || true)
  for REF in $REFS; do
    # Check if ref includes "(proposed)" qualifier
    if grep -L "ADR-$ADR (proposed)" "$REF" | grep -q "ADR-$ADR"; then
      echo "STATUS DRIFT: $REF cites ADR-$ADR without (proposed) qualifier"
      DRIFT=$((DRIFT + 1))
    fi
  done
done

if [ "$DRIFT" -gt 0 ]; then
  echo "FAIL: $DRIFT ADR status-drift refs"
  exit 1
fi
echo "PASS: 0 ADR drift"
```

### Script: `infra/scripts/check-i1-bootstrap-coverage.sh`

```bash
#!/usr/bin/env bash
# Verify I1 hospitality-package + _apply.sql cover all workspace_settings fields
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"

# Extract workspace_settings fields from migrations
FIELDS=$(grep -A 50 "CREATE TABLE payroll.workspace_settings" "$ROOT/supabase/migrations/"*.sql | grep -oE "^\s+[a-z_]+\s" | sed 's/[ ]//g' | sort -u)

# Cross-ref hospitality-package
HOSP="$ROOT/packages/ai/src/industry/packages/hospitality.ts"
TEMPLATE="$ROOT/supabase/templates/restaurant/_apply.sql"

MISSING=0
for FIELD in $FIELDS; do
  if ! grep -q "$FIELD" "$HOSP" && ! grep -q "$FIELD" "$TEMPLATE"; then
    echo "BOOTSTRAP MISS: workspace_settings.$FIELD not in I1 seed"
    MISSING=$((MISSING + 1))
  fi
done

if [ "$MISSING" -gt 0 ]; then
  echo "FAIL: $MISSING bootstrap-bypass fields"
  exit 1
fi
echo "PASS: I1 bootstrap covers all workspace_settings"
```

### GitHub Action: `.github/workflows/doc-schema-drift.yml`

```yaml
name: Doc Schema Drift Check
on:
  pull_request:
    paths:
      - 'docs/modules/**'
      - 'docs/architecture/**'
      - 'supabase/migrations/**'
      - 'packages/supabase/src/database.types.ts'

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run table drift check
        run: ./infra/scripts/check-doc-schema-drift.sh
      - name: Run ADR status drift check
        run: ./infra/scripts/check-adr-status-drift.sh
      - name: Run I1 bootstrap coverage check
        run: ./infra/scripts/check-i1-bootstrap-coverage.sh
```

---

## 7. Phase Rollout

### Phase D1 — Tier 1 detection (1 sortie, 1 dev day)

**Deliverable:**
- `infra/scripts/check-doc-schema-drift.sh` working
- `infra/scripts/check-adr-status-drift.sh` working
- GitHub Action `doc-schema-drift.yml` on PR
- Initial baseline: run on `development`, fix all existing drift, commit baseline

**Acceptance:**
- Script catches the R1/R2/Y1 patterns from cascade-audit
- PR opening with phantom-table reference fails CI
- All existing payroll docs pass after Y1 fix already committed

### Phase D2 — Tier 2 heartbeat (1 sortie, 0.5 dev day)

**Deliverable:**
- `~/dev/second-brain-v2/HEARTBEAT.md` adds `doc-schema-audit` job
- Weekly cron via heartbeat
- Telegram alert wired

**Acceptance:**
- Weekly run produces `ops/reports/YYYY-MM-DD-doc-schema-audit.md`
- Telegram fires when drift increases vs prior week

### Phase D3 — Tier 3 system-steward integration (0 dev days, process)

**Deliverable:**
- Update `.claude/agents/system-steward.md` with cascade-audit checklist
- Update sortie-spec template (`docs/templates/`) Pre-Flight section to include drift-check
- Update close-feature.sh to gate on drift-clean state

**Acceptance:**
- Next sortie-spec includes drift-check step
- close-feature blocks if drift found post-build

### Phase D4 — I1 bootstrap-coverage (1 sortie, 0.5 dev day)

**Deliverable:**
- `infra/scripts/check-i1-bootstrap-coverage.sh` working
- Migration PR template includes bootstrap-checklist
- Existing payroll workspace_settings fields backfilled in hospitality.ts

**Acceptance:**
- Bootstrap-script catches the O30 pattern from cascade-audit
- Migration PR with new workspace_settings field cannot merge without bootstrap-update

### Phase D5 — ADR-promote sweep automation (1 sortie, 1 dev day)

**Deliverable:**
- `infra/scripts/promote-adr.sh <ADR-NUMBER>` — promotes status + sweeps doc-refs
- Per-ADR-promote: removes "(proposed)" qualifiers from cited docs
- Adds "(accepted YYYY-MM-DD)" timestamp

**Acceptance:**
- Script handles the R6 pattern (proposed→accepted with sweep)
- ADR template includes promote-checklist

---

## 8. Cumulative Acceptance — Drift-Free State

After all 5 phases:

1. **No phantom-table refs** in `docs/modules/` or `docs/architecture/` (Tier 1 CI gate)
2. **No ADR-status drift** — every ADR-XXXX ref qualified correctly (Tier 1 CI gate)
3. **No bootstrap-bypass** — every workspace_settings field present in I1 + template (Tier 1 CI gate)
4. **Weekly proactive audit** runs (Tier 2 heartbeat)
5. **Per-sortie pre-flight** verifies before kick-off (Tier 3 process)
6. **Per-sortie post-build** verifies before close-feature (Tier 3 + close-feature.sh)

Drift-detection cost: ~30 sec per CI run. Recovery cost: minutes (find-replace) for Class A, hours (re-design) for Class B–D.

---

## 9. Implementation Sequencing — Linear Tasks

Per ADR-0265 / Linear protocol:

```
EPIC: Drift Prevention System
├── Story D1.1 — Implement check-doc-schema-drift.sh + GitHub Action
├── Story D1.2 — Baseline-fix existing drift on development
├── Story D2.1 — Heartbeat doc-schema-audit job + Telegram wiring
├── Story D3.1 — Update system-steward agent + sortie-spec template
├── Story D3.2 — Extend close-feature.sh with drift-gate
├── Story D4.1 — Implement check-i1-bootstrap-coverage.sh
├── Story D4.2 — Backfill payroll workspace_settings in hospitality.ts (also closes O30)
└── Story D5.1 — Implement promote-adr.sh + ADR template update
```

Total: 1 epic + 8 stories. Estimat: 3 dev days + 1 dag baseline-fix.

---

## 10. Out-of-Scope (separate efforts)

- **Code-vs-doc drift detection** (Class C) — krever LSP eller Tree-sitter parsing av TS/SQL. Defer to v2.
- **Cross-ADR-consistency** — e.g. ADR-0250 + ADR-0251 må være accepted i samme batch hvis de avhenger av hverandre. Defer.
- **Stale-link detection** — markdown-links til `docs/X.md` som ikke finnes. Eksisterende `markdown-link-check` håndterer dette.
- **Telemetry-event consistency** (cascade-audit MISSING #5) — separat verifier, ikke drift-prevention.

---

## 11. Cross-references

- Cascade-audit: [AUDIT-CASCADE-2026-05-06.md](./AUDIT-CASCADE-2026-05-06.md)
- Open questions trigget: O25, O26, O27, O28, O29, O30
- ADR pattern: ADR-0265 (deployment pipeline) — same gate-based prevention model
- Existing audit infrastructure: `.claude/skills/adr-contract-audit/`
- L-0098 (prior-council staleness) — same drift class
- Heartbeat: `~/.claude/skills/heartbeat/SKILL.md`

## 12. Why This Plan Works

1. **Catches drift at write-time** — author runs script before publishing spec
2. **Catches drift at PR-time** — CI gates blocking merge
3. **Catches drift at sortie-time** — system-steward pre-flight
4. **Catches drift at close-time** — close-feature gates
5. **Catches drift at week-time** — heartbeat audit
6. **Recovery is cheap** — find-replace for Class A; minutes for Class B–D
7. **Falsifiable** — every gate has clear pass/fail signal

The cascade-audit found 8 RED drift findings AFTER docs were already committed.
With this plan, drift would have been caught before commit (Tier 1 CI gate).
