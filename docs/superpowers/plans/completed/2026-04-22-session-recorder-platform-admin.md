# Session Recorder + Platform Admin Intervention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement session-level recording of every Emma turn with tiered retention, Platform Admin intervention surface (flag + whisper + force-stop + break-glass PII reveal), and Supabase Realtime transport. Resolves `BOTSSON-SYSTEM-MAP.md` D1 (🔴 → 🟢) and "agent-session-recording tabell finnes ikke".

**Architecture:** 3 new tables (`agent_session_recording`, `agent_session_envelope`, `agent_session_whisper`) in `public` schema. Stage-engine helper `session-recorder.ts` hooks into 4 invisible-today steps (classifier, authority, prompt-build, LLM call) via fire-and-forget ring buffer. PII redact-on-write with pgcrypto-encrypted break-glass envelope. Platform Admin Guardian UI extended — not forked. Supabase Realtime for live fleet view.

**Tech Stack:** Postgres 17 + pgcrypto, Supabase RLS + Realtime, TypeScript strict, Hono (stage-engine), Next.js App Router (BFF + Platform Admin UI), shadcn/ui + Framer Motion (Nordic Split), Zod validation, Vitest, Playwright E2E.

**Spec:** [`docs/superpowers/specs/2026-04-22-session-recorder-platform-admin-design.md`](../specs/2026-04-22-session-recorder-platform-admin-design.md)
**ADRs:** 0184 (Session Recorder), 0185 (Platform Admin Intervention)
**Learnings bound:** L-0042 (migration timestamp ordering), L-0109, L-0110, L-0111, L-0112

---

## Prerequisite Gate (MANDATORY — block all tasks below until satisfied)

Before Task 1, verify Phase 0 prereqs:

- [ ] **A3 memory-writer landed** — `grep -n '.from("engine_memory").insert' services/stage-engine/src/core/memory-manager.ts` returns ≥1 match
- [ ] **A5 intent-classifier context fixed** — `grep -n 'classifyIntent(' services/stage-engine/src/core/agent-router.ts` shows second arg is NOT `""`
- [ ] **A6 guardian-bus → pg_notify** — `grep -n 'pg_notify\|LISTEN\|NOTIFY' services/stage-engine/src/core/guardian-bus.ts` returns ≥1 match
- [ ] **System map reflects 🟢** — `grep -c "🟢" docs/architecture/BOTSSON-SYSTEM-MAP.md` ≥ previous count + 3 (A3, A5, A6 rows)

**If any fail:** STOP. Return to campaign and land A3/A5/A6 plans first. This plan must not execute against an incomplete substrate (see L-0109).

---

## File Structure

### New files
```
supabase/migrations/
  <ts+0>_agent_session_recording.sql              # main table
  <ts+1>_agent_session_envelope.sql               # PII break-glass
  <ts+2>_agent_session_whisper.sql                # admin injection
  <ts+3>_recorder_authority_seed.sql              # C4 authority rows
  <ts+4>_recorder_retention_cron.sql              # pg_cron purge jobs

services/stage-engine/src/core/
  session-recorder.ts                             # ring buffer + flush + recordTurn()

packages/ai/src/lib/
  pii-redact.ts                                   # regex-based redaction + envelope hook
  pii-redact.test.ts
  attention-score.ts                              # composite scoring
  attention-score.test.ts

apps/web/src/app/api/botsson/recorder/
  flag/route.ts                                   # POST — flag a turn
  whisper/route.ts                                # POST — create whisper
  sessions/[id]/route.ts                          # GET — full session dump
  break-glass/[envelope_id]/route.ts              # GET — reveal raw PII (audit-logged)

apps/web/src/app/platform-admin/guardian/_components/
  TurnTimeline.tsx                                # vertical transcript cards
  TurnCard.tsx                                    # single turn with verdict chip
  RedactedPill.tsx                                # warm-muted PII placeholder
  AdminActionDrawer.tsx                           # whisper + flag + force-stop drawer
  BreakGlassReveal.tsx                            # 5s reveal affordance

apps/web/src/app/platform-admin/guardian/_hooks/
  useRecorderSessions.ts                          # Realtime subscription
  useTurnTimeline.ts                              # fetch + paginate turns

apps/e2e/tests/botsson-recorder/
  schedule-wrong-day-replay.spec.ts               # Q17 acceptance
  pii-break-glass.spec.ts
  recorder-failure-resilience.spec.ts
  whisper-never-user-facing.spec.ts               # ADR-0078 enforcement

docs/journeys/
  JOURNEY-session-recorder-platform-admin.md      # 4 user journeys
```

### Modified files
```
services/stage-engine/src/core/prompt-builder.ts
services/stage-engine/src/core/agent-router.ts
services/stage-engine/src/core/authority.ts
services/stage-engine/src/core/guardian-evaluator.ts
services/stage-engine/src/core/memory-manager.ts

apps/web/src/app/platform-admin/guardian/_components/SessionList.tsx
apps/web/src/app/platform-admin/guardian/_components/SessionDetails.tsx
apps/web/src/app/platform-admin/guardian/_components/StageAnalysis.tsx
apps/web/src/app/platform-admin/guardian/_components/AlertsList.tsx
apps/web/src/app/platform-admin/guardian/_components/WhisperInput.tsx
apps/web/src/app/platform-admin/guardian/_hooks/useGuardianSocket.ts

apps/web/src/app/Botsson/_components/BotssonArena.tsx    # LogView hover-flag affordance

docs/architecture/BOTSSON-SYSTEM-MAP.md                    # D1 row 🔴 → 🟢
docs/plans/CAMPAIGN-botsson-arena.md                       # Phase D1 complete
docs/decisions/0184-session-recorder.md                    # status proposed → accepted
docs/decisions/0185-platform-admin-session-intervention.md # status proposed → accepted
```

---

## Phase 1a — Foundation (migrations, utilities, helper)

### Task 1: Migration — `agent_session_recording` table

**Files:**
- Create: `supabase/migrations/<ts+0>_agent_session_recording.sql`

- [ ] **Step 1: Pick migration timestamp (L-0042 compliance)**

```bash
# Find current repo tip
ls supabase/migrations/ | tail -1

# Verify dependencies exist with earlier timestamps
grep -l "CREATE TABLE.*workspace" supabase/migrations/*.sql | tail -1
grep -l "CREATE TABLE.*profile" supabase/migrations/*.sql | tail -1
grep -l "CREATE TABLE.*engine_state" supabase/migrations/*.sql | tail -1
```

Pick timestamp strictly greater than `ls supabase/migrations/ | tail -1`. Record as `<ts+0>` = e.g. `20260601100000` (adjust based on actual repo tip).

- [ ] **Step 2: Write migration SQL**

```sql
-- supabase/migrations/<ts+0>_agent_session_recording.sql
-- ADR-0184 — Session Recorder Architecture
-- L-0042 timestamp verified: tip is <actual_tip>, deps workspace/profile/engine_state all earlier

CREATE TABLE public.agent_session_recording (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id             uuid NOT NULL,
  workspace_id           uuid NOT NULL REFERENCES public.workspace(id) ON DELETE CASCADE,
  profile_id             uuid REFERENCES public.profile(id) ON DELETE SET NULL,
  engine_state_id        uuid REFERENCES public.engine_state(id) ON DELETE SET NULL,
  turn_index             int NOT NULL,
  turn_kind              text NOT NULL CHECK (turn_kind IN (
    'user_input','agent_response','tool_call','tool_result',
    'guardian_verdict','memory_read','memory_write','whisper'
  )),
  phase                  text NOT NULL CHECK (phase IN (
    'classifier_input','classifier_output','authority_load','context_collect',
    'prompt_built','llm_request','llm_response','tool_exec','guardian_eval','post_turn'
  )),
  content_redacted       jsonb NOT NULL,
  content_envelope_id    uuid,  -- FK added after envelope table
  meta                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_flagged             boolean NOT NULL DEFAULT false,
  flag_reason            text,
  flagged_by_profile_id  uuid REFERENCES public.profile(id) ON DELETE SET NULL,
  attention_score        numeric(4,2) CHECK (attention_score >= 0 AND attention_score <= 1),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_asr_session_turn ON public.agent_session_recording (session_id, turn_index);
CREATE INDEX idx_asr_workspace_created ON public.agent_session_recording (workspace_id, created_at DESC);
CREATE INDEX idx_asr_engine_state ON public.agent_session_recording (engine_state_id) WHERE engine_state_id IS NOT NULL;
CREATE INDEX idx_asr_flagged ON public.agent_session_recording (is_flagged, created_at DESC) WHERE is_flagged = true;
CREATE INDEX idx_asr_high_attention ON public.agent_session_recording (attention_score DESC) WHERE attention_score > 0.7;

-- Updated-at trigger (standard Smartout pattern)
CREATE TRIGGER trg_asr_updated_at
  BEFORE UPDATE ON public.agent_session_recording
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.agent_session_recording ENABLE ROW LEVEL SECURITY;

-- JWT read policy: workspace admins read their workspace
CREATE POLICY "jwt_admin_read_asr" ON public.agent_session_recording
  FOR SELECT
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(workspace_id)
  );

-- Platform admin (godmode) reads cross-workspace
CREATE POLICY "godmode_read_asr" ON public.agent_session_recording
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_identity
      WHERE user_identity.id = auth.uid() AND user_identity.is_godmode = true
    )
  );

-- Service role writes (stage-engine only — no user-facing write path)
-- Default service-role bypass is sufficient. No explicit INSERT policy needed.

COMMENT ON TABLE public.agent_session_recording IS
  'ADR-0184: Per-turn agent session recording. Redact-on-write for PII. Tiered retention via cron.';
```

- [ ] **Step 3: Apply migration locally**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<ts+0>_agent_session_recording.sql
```

Expected: `CREATE TABLE` + `CREATE INDEX` × 5 + `CREATE TRIGGER` + `ALTER TABLE` + `CREATE POLICY` × 2 + `COMMENT`. No errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/<ts+0>_agent_session_recording.sql
git commit -m "feat(db): agent_session_recording table (ADR-0184)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Migration — `agent_session_envelope` (break-glass PII)

**Files:**
- Create: `supabase/migrations/<ts+1>_agent_session_envelope.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/<ts+1>_agent_session_envelope.sql
-- ADR-0184 § Redaction Pipeline — reversible break-glass for PII

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.agent_session_envelope (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES public.workspace(id) ON DELETE CASCADE,
  encrypted_payload  bytea NOT NULL,
  pii_class          text NOT NULL CHECK (pii_class IN (
    'personnummer','bank','email','phone','address','salary','medical','free_text'
  )),
  created_at         timestamptz NOT NULL DEFAULT now(),
  redact_after       timestamptz NOT NULL
);

CREATE INDEX idx_ase_redact_after ON public.agent_session_envelope (redact_after);
CREATE INDEX idx_ase_workspace ON public.agent_session_envelope (workspace_id);

-- Add FK from recording back to envelope
ALTER TABLE public.agent_session_recording
  ADD CONSTRAINT fk_asr_envelope
  FOREIGN KEY (content_envelope_id)
  REFERENCES public.agent_session_envelope(id)
  ON DELETE SET NULL;

-- RLS — godmode only for envelope reads (break-glass is platform-admin)
ALTER TABLE public.agent_session_envelope ENABLE ROW LEVEL SECURITY;

CREATE POLICY "godmode_only_read_envelope" ON public.agent_session_envelope
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_identity
      WHERE user_identity.id = auth.uid() AND user_identity.is_godmode = true
    )
  );

COMMENT ON TABLE public.agent_session_envelope IS
  'ADR-0184 § PII: encrypted break-glass envelope. Raw PII accessed only via BFF /recorder/break-glass endpoint (audit-logged).';
```

- [ ] **Step 2: Apply**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<ts+1>_agent_session_envelope.sql
```

Expected: `CREATE EXTENSION` + `CREATE TABLE` + `CREATE INDEX` × 2 + `ALTER TABLE` + `ALTER TABLE` + `CREATE POLICY` + `COMMENT`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/<ts+1>_agent_session_envelope.sql
git commit -m "feat(db): agent_session_envelope table with pgcrypto (ADR-0184)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Migration — `agent_session_whisper`

**Files:**
- Create: `supabase/migrations/<ts+2>_agent_session_whisper.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/<ts+2>_agent_session_whisper.sql
-- ADR-0185 — Platform Admin Whisper (metadata injection, never user-facing)

CREATE TABLE public.agent_session_whisper (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL,
  workspace_id     uuid NOT NULL REFERENCES public.workspace(id) ON DELETE CASCADE,
  admin_profile_id uuid NOT NULL REFERENCES public.profile(id) ON DELETE RESTRICT,
  content          text NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  is_consumed      boolean NOT NULL DEFAULT false,
  consumed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_asw_session_unconsumed
  ON public.agent_session_whisper (session_id, created_at)
  WHERE is_consumed = false;

ALTER TABLE public.agent_session_whisper ENABLE ROW LEVEL SECURITY;

-- Workspace admin reads/writes their workspace whispers
CREATE POLICY "jwt_admin_rw_whisper" ON public.agent_session_whisper
  FOR ALL
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(workspace_id)
  );

-- Godmode cross-workspace
CREATE POLICY "godmode_rw_whisper" ON public.agent_session_whisper
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_identity
      WHERE user_identity.id = auth.uid() AND user_identity.is_godmode = true
    )
  );

COMMENT ON TABLE public.agent_session_whisper IS
  'ADR-0185: Admin whispers — <admin_note> metadata injected into next-turn system prompt. NEVER rendered to user.';
```

- [ ] **Step 2: Apply + commit**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<ts+2>_agent_session_whisper.sql
git add supabase/migrations/<ts+2>_agent_session_whisper.sql
git commit -m "feat(db): agent_session_whisper table (ADR-0185)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Migration — Authority seed

**Files:**
- Create: `supabase/migrations/<ts+3>_recorder_authority_seed.sql`

- [ ] **Step 1: Write seed**

```sql
-- supabase/migrations/<ts+3>_recorder_authority_seed.sql
-- ADR-0185 — C4 authority defaults for recorder intervention capabilities

-- Per-workspace defaults (idempotent)
INSERT INTO public.engine_authority_config (workspace_id, capability, level)
SELECT w.id, cap.capability, cap.level
FROM public.workspace w
CROSS JOIN (VALUES
  ('recorder.flag'::text, 'suggest'::authority_level),
  ('recorder.whisper', 'confirm'),
  ('recorder.force_stop', 'confirm')
) AS cap(capability, level)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- Platform-scope (NULL workspace_id) defaults for godmode-only
INSERT INTO public.engine_authority_config (workspace_id, capability, level)
VALUES
  (NULL, 'recorder.pii_reveal', 'confirm'),
  (NULL, 'recorder.break_glass_enable', 'disabled')
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Includes recorder.* capabilities per ADR-0185 (flag, whisper, force_stop, pii_reveal, break_glass_enable)';
```

- [ ] **Step 2: Verify `authority_level` enum has `disabled`**

```bash
grep -A 20 "export.*authority_level" packages/supabase/src/database.types.ts | head -25
```

Expected: enum includes `'autonomous' | 'confirm' | 'suggest' | 'read_only' | 'disabled'`. If `disabled` missing, STOP and escalate — enum extension is a separate ADR.

- [ ] **Step 3: Apply + commit**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<ts+3>_recorder_authority_seed.sql
git add supabase/migrations/<ts+3>_recorder_authority_seed.sql
git commit -m "feat(db): seed recorder authority defaults (ADR-0185)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Migration — Retention cron jobs

**Files:**
- Create: `supabase/migrations/<ts+4>_recorder_retention_cron.sql`

- [ ] **Step 1: Write cron**

```sql
-- supabase/migrations/<ts+4>_recorder_retention_cron.sql
-- ADR-0184 § Tiered Retention
-- Metadata permanent; redacted-content 90d; envelope 30d; flagged 1y

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Purge redacted content payload after 90d, keep metadata
SELECT cron.schedule(
  'purge_recorder_redacted_content',
  '0 3 * * *',  -- 03:00 daily
  $$
    UPDATE public.agent_session_recording
    SET content_redacted = '{"_retention_purged": true}'::jsonb
    WHERE created_at < now() - interval '90 days'
      AND is_flagged = false
      AND content_redacted ? '_retention_purged' = false;
  $$
);

-- Purge envelope (encrypted payload) after TTL
SELECT cron.schedule(
  'purge_recorder_envelopes',
  '15 3 * * *',  -- 03:15 daily
  $$
    DELETE FROM public.agent_session_envelope
    WHERE redact_after < now();
  $$
);

-- Purge flagged sessions after 1 year
SELECT cron.schedule(
  'purge_flagged_sessions',
  '30 3 * * *',  -- 03:30 daily
  $$
    UPDATE public.agent_session_recording
    SET content_redacted = '{"_retention_purged": true}'::jsonb,
        content_envelope_id = NULL
    WHERE is_flagged = true
      AND created_at < now() - interval '365 days';
  $$
);

COMMENT ON EXTENSION pg_cron IS
  'Recorder retention jobs scheduled. See ADR-0184 § Tiered Retention.';
```

- [ ] **Step 2: Apply + commit**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<ts+4>_recorder_retention_cron.sql
git add supabase/migrations/<ts+4>_recorder_retention_cron.sql
git commit -m "feat(db): recorder retention cron jobs (ADR-0184)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Regenerate types

- [ ] **Step 1: Regen**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 2: Verify new tables present**

```bash
grep -n "agent_session_recording\|agent_session_envelope\|agent_session_whisper" packages/supabase/src/database.types.ts | head -10
```

Expected: ≥6 matches (Row/Insert/Update types for each table).

- [ ] **Step 3: Typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/supabase
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "chore(types): regen after recorder migrations

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: PII redaction utility

**Files:**
- Create: `packages/ai/src/lib/pii-redact.ts`
- Test: `packages/ai/src/lib/pii-redact.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/ai/src/lib/pii-redact.test.ts
import { describe, expect, it } from "vitest";
import { redactPII, PII_CLASSES } from "./pii-redact.js";

describe("redactPII", () => {
  it("redacts Norwegian personnummer (11 digits with dash)", () => {
    const r = redactPII("Mitt fødselsnummer er 12345678901");
    expect(r.redacted).toBe("Mitt fødselsnummer er <personnummer>");
    expect(r.envelopes).toHaveLength(1);
    expect(r.envelopes[0]!.pii_class).toBe("personnummer");
    expect(r.envelopes[0]!.raw).toBe("12345678901");
  });

  it("redacts bank account (11 digits with standard format)", () => {
    const r = redactPII("Konto: 1234.56.78901");
    expect(r.redacted).toContain("<bank>");
    expect(r.envelopes[0]!.pii_class).toBe("bank");
  });

  it("redacts email addresses", () => {
    const r = redactPII("Send til test@example.no");
    expect(r.redacted).toContain("<email>");
    expect(r.envelopes[0]!.raw).toBe("test@example.no");
  });

  it("redacts Norwegian phone +47 format", () => {
    const r = redactPII("Ring +47 12345678");
    expect(r.redacted).toContain("<phone>");
  });

  it("returns original string when no PII present", () => {
    const r = redactPII("Hvor er kantinen?");
    expect(r.redacted).toBe("Hvor er kantinen?");
    expect(r.envelopes).toHaveLength(0);
  });

  it("handles multiple PII in same string", () => {
    const r = redactPII("Email: a@b.no og tlf +47 12345678");
    expect(r.envelopes).toHaveLength(2);
    expect(r.redacted).toContain("<email>");
    expect(r.redacted).toContain("<phone>");
  });

  it("redacts JSON object recursively (for LLM payload capture)", () => {
    const input = { message: "Personnummer: 12345678901", meta: { ok: true } };
    const r = redactPII(input);
    expect(r.redactedObj.message).toContain("<personnummer>");
    expect(r.redactedObj.meta.ok).toBe(true);
  });
});

describe("PII_CLASSES", () => {
  it("exports all 8 classes", () => {
    expect(PII_CLASSES).toEqual([
      "personnummer", "bank", "email", "phone",
      "address", "salary", "medical", "free_text"
    ]);
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
pnpm vitest run packages/ai/src/lib/pii-redact.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// packages/ai/src/lib/pii-redact.ts
// ADR-0184 § Redaction Pipeline — regex-based redact-on-write
// Known-PII classes redact to placeholder; raw returned for envelope storage.

export const PII_CLASSES = [
  "personnummer",
  "bank",
  "email",
  "phone",
  "address",
  "salary",
  "medical",
  "free_text",
] as const;

export type PiiClass = (typeof PII_CLASSES)[number];

type EnvelopeEntry = { pii_class: PiiClass; raw: string };

type RedactResult = {
  redacted: string;
  redactedObj?: unknown;
  envelopes: EnvelopeEntry[];
};

// Patterns ordered by specificity (most specific first)
const PATTERNS: Array<{ cls: PiiClass; re: RegExp }> = [
  { cls: "personnummer", re: /\b\d{6}[-\s]?\d{5}\b/g },
  { cls: "bank", re: /\b\d{4}[.\s]?\d{2}[.\s]?\d{5}\b/g },
  { cls: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { cls: "phone", re: /\b(?:\+47|0047)?\s?\d{8}\b/g },
  { cls: "salary", re: /\b\d{4,7}\s?(?:kr|NOK|,-)\b/gi },
];

export function redactPII(input: string | Record<string, unknown>): RedactResult {
  if (typeof input === "string") {
    return redactString(input);
  }
  return redactObject(input);
}

function redactString(s: string): RedactResult {
  const envelopes: EnvelopeEntry[] = [];
  let out = s;
  for (const { cls, re } of PATTERNS) {
    out = out.replace(re, (match) => {
      envelopes.push({ pii_class: cls, raw: match });
      return `<${cls}>`;
    });
  }
  return { redacted: out, envelopes };
}

function redactObject(obj: Record<string, unknown>): RedactResult {
  const envelopes: EnvelopeEntry[] = [];
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const r = redactString(v);
      envelopes.push(...r.envelopes);
      return r.redacted;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  const redactedObj = walk(obj);
  return {
    redacted: JSON.stringify(redactedObj),
    redactedObj,
    envelopes,
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm vitest run packages/ai/src/lib/pii-redact.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/lib/pii-redact.ts packages/ai/src/lib/pii-redact.test.ts
git commit -m "feat(ai): PII redact-on-write utility (ADR-0184)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Attention-score utility

**Files:**
- Create: `packages/ai/src/lib/attention-score.ts`
- Test: `packages/ai/src/lib/attention-score.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/ai/src/lib/attention-score.test.ts
import { describe, expect, it } from "vitest";
import { computeAttentionScore } from "./attention-score.js";

describe("computeAttentionScore", () => {
  it("returns 0 for clean session", () => {
    expect(computeAttentionScore({
      guardian_block_count: 0,
      guardian_warn_count: 0,
      retry_loop_detected: false,
      latency_anomaly: false,
      pii_leak_flagged: false,
      manual_flag: false,
    })).toBe(0);
  });

  it("caps at 1.0 for maximum violations", () => {
    expect(computeAttentionScore({
      guardian_block_count: 10,
      guardian_warn_count: 10,
      retry_loop_detected: true,
      latency_anomaly: true,
      pii_leak_flagged: true,
      manual_flag: true,
    })).toBe(1);
  });

  it("manual_flag adds 0.3", () => {
    expect(computeAttentionScore({
      guardian_block_count: 0,
      guardian_warn_count: 0,
      retry_loop_detected: false,
      latency_anomaly: false,
      pii_leak_flagged: false,
      manual_flag: true,
    })).toBeCloseTo(0.3, 2);
  });

  it("guardian_block weights heaviest", () => {
    const withBlock = computeAttentionScore({
      guardian_block_count: 1,
      guardian_warn_count: 0,
      retry_loop_detected: false,
      latency_anomaly: false,
      pii_leak_flagged: false,
      manual_flag: false,
    });
    const withWarn = computeAttentionScore({
      guardian_block_count: 0,
      guardian_warn_count: 1,
      retry_loop_detected: false,
      latency_anomaly: false,
      pii_leak_flagged: false,
      manual_flag: false,
    });
    expect(withBlock).toBeGreaterThan(withWarn);
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
pnpm vitest run packages/ai/src/lib/attention-score.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// packages/ai/src/lib/attention-score.ts
// ADR-0184 Q7 — composite attention score for session triage ranking.

export type AttentionInputs = {
  guardian_block_count: number;
  guardian_warn_count: number;
  retry_loop_detected: boolean;
  latency_anomaly: boolean;
  pii_leak_flagged: boolean;
  manual_flag: boolean;
};

// Weights: manual_flag + pii_leak are strongest single-signal; guardian counts accumulate.
const W = {
  block: 0.2,    // per occurrence, max 3 = 0.6
  warn: 0.08,    // per occurrence
  retry: 0.15,
  latency: 0.1,
  pii: 0.25,
  manual: 0.3,
};

export function computeAttentionScore(i: AttentionInputs): number {
  const raw =
    Math.min(i.guardian_block_count, 3) * W.block +
    Math.min(i.guardian_warn_count, 5) * W.warn +
    (i.retry_loop_detected ? W.retry : 0) +
    (i.latency_anomaly ? W.latency : 0) +
    (i.pii_leak_flagged ? W.pii : 0) +
    (i.manual_flag ? W.manual : 0);
  return Math.min(1, Math.max(0, Number(raw.toFixed(2))));
}
```

- [ ] **Step 4: Verify pass**

```bash
pnpm vitest run packages/ai/src/lib/attention-score.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/lib/attention-score.ts packages/ai/src/lib/attention-score.test.ts
git commit -m "feat(ai): attention-score composite for session triage (ADR-0184)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Session-recorder helper

**Files:**
- Create: `services/stage-engine/src/core/session-recorder.ts`
- Test: `services/stage-engine/src/core/session-recorder.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// services/stage-engine/src/core/session-recorder.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createRecorder, type RecordTurnInput } from "./session-recorder.js";

const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
};

describe("session-recorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flushes buffered turns to DB", async () => {
    const r = createRecorder({ supabase: mockSupabase as never, flushIntervalMs: 10 });
    const input: RecordTurnInput = {
      sessionId: "s1",
      workspaceId: "w1",
      turnKind: "user_input",
      phase: "classifier_input",
      content: { text: "hei" },
    };
    r.recordTurn(input);
    await new Promise((res) => setTimeout(res, 30));
    expect(mockSupabase.from).toHaveBeenCalledWith("agent_session_recording");
  });

  it("redacts PII before INSERT", async () => {
    const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const sb = { from: vi.fn(() => ({ insert: insertSpy })) };
    const r = createRecorder({ supabase: sb as never, flushIntervalMs: 10 });
    r.recordTurn({
      sessionId: "s1",
      workspaceId: "w1",
      turnKind: "user_input",
      phase: "classifier_input",
      content: { text: "Personnummer: 12345678901" },
    });
    await new Promise((res) => setTimeout(res, 30));
    const call = insertSpy.mock.calls[0]![0]![0];
    expect(JSON.stringify(call.content_redacted)).toContain("<personnummer>");
    expect(JSON.stringify(call.content_redacted)).not.toContain("12345678901");
  });

  it("drops oldest on buffer overflow (fire-and-forget)", async () => {
    const sb = { from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ data: null, error: null }) })) };
    const r = createRecorder({ supabase: sb as never, flushIntervalMs: 9999, maxBuffer: 3 });
    for (let i = 0; i < 10; i++) {
      r.recordTurn({
        sessionId: "s1", workspaceId: "w1",
        turnKind: "user_input", phase: "classifier_input",
        content: { i },
      });
    }
    expect(r.getDropCount()).toBe(7);
    expect(r.getBufferSize()).toBe(3);
  });

  it("never throws on DB error (recorder never blocks Emma)", async () => {
    const sb = { from: vi.fn(() => ({ insert: vi.fn().mockRejectedValue(new Error("db down")) })) };
    const r = createRecorder({ supabase: sb as never, flushIntervalMs: 10 });
    r.recordTurn({
      sessionId: "s1", workspaceId: "w1",
      turnKind: "user_input", phase: "classifier_input",
      content: { ok: true },
    });
    await new Promise((res) => setTimeout(res, 30));
    // No unhandled promise rejection; error counter increments
    expect(r.getErrorCount()).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
pnpm vitest run services/stage-engine/src/core/session-recorder.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// services/stage-engine/src/core/session-recorder.ts
// ADR-0184 — Session Recorder helper.
// Fire-and-forget ring buffer + async flush. NEVER blocks Emma on DB error.

import type { SupabaseClient } from "@supabase/supabase-js";
import { redactPII } from "@smartout/ai/lib/pii-redact";

type TurnKind =
  | "user_input" | "agent_response" | "tool_call" | "tool_result"
  | "guardian_verdict" | "memory_read" | "memory_write" | "whisper";

type TurnPhase =
  | "classifier_input" | "classifier_output" | "authority_load"
  | "context_collect" | "prompt_built" | "llm_request" | "llm_response"
  | "tool_exec" | "guardian_eval" | "post_turn";

export type RecordTurnInput = {
  sessionId: string;
  workspaceId: string;
  profileId?: string;
  engineStateId?: string;
  turnIndex?: number;
  turnKind: TurnKind;
  phase: TurnPhase;
  content: unknown;
  meta?: Record<string, unknown>;
};

type Recorder = {
  recordTurn(input: RecordTurnInput): void;
  getBufferSize(): number;
  getDropCount(): number;
  getErrorCount(): number;
};

type RecorderOptions = {
  supabase: SupabaseClient;
  flushIntervalMs?: number;
  maxBuffer?: number;
};

type BufferedRow = {
  session_id: string;
  workspace_id: string;
  profile_id?: string;
  engine_state_id?: string;
  turn_index: number;
  turn_kind: TurnKind;
  phase: TurnPhase;
  content_redacted: unknown;
  meta: Record<string, unknown>;
};

export function createRecorder(opts: RecorderOptions): Recorder {
  const flushMs = opts.flushIntervalMs ?? 500;
  const maxBuffer = opts.maxBuffer ?? 1000;
  const buffer: BufferedRow[] = [];
  let drops = 0;
  let errors = 0;
  // Per-session turn counter (naive, flushes keep memory bounded to buffer size)
  const turnCounter = new Map<string, number>();

  const nextTurn = (sid: string) => {
    const n = (turnCounter.get(sid) ?? -1) + 1;
    turnCounter.set(sid, n);
    return n;
  };

  const flush = async () => {
    if (buffer.length === 0) return;
    const batch = buffer.splice(0, buffer.length);
    try {
      const { error } = await opts.supabase
        .from("agent_session_recording")
        .insert(batch);
      if (error) errors++;
    } catch {
      errors++;
    }
  };

  setInterval(() => {
    void flush();
  }, flushMs);

  return {
    recordTurn(input) {
      const r = redactPII(input.content as string | Record<string, unknown>);
      const row: BufferedRow = {
        session_id: input.sessionId,
        workspace_id: input.workspaceId,
        profile_id: input.profileId,
        engine_state_id: input.engineStateId,
        turn_index: input.turnIndex ?? nextTurn(input.sessionId),
        turn_kind: input.turnKind,
        phase: input.phase,
        content_redacted: r.redactedObj ?? r.redacted,
        meta: {
          ...(input.meta ?? {}),
          _envelope_count: r.envelopes.length,
        },
      };
      if (buffer.length >= maxBuffer) {
        buffer.shift();
        drops++;
      }
      buffer.push(row);
    },
    getBufferSize: () => buffer.length,
    getDropCount: () => drops,
    getErrorCount: () => errors,
  };
}
```

- [ ] **Step 4: Add `@smartout/ai` to stage-engine deps if missing**

```bash
grep '"@smartout/ai"' services/stage-engine/package.json
```

If missing, add to dependencies as `"workspace:*"`, then `pnpm install`.

- [ ] **Step 5: Verify tests pass**

```bash
pnpm vitest run services/stage-engine/src/core/session-recorder.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add services/stage-engine/src/core/session-recorder.ts services/stage-engine/src/core/session-recorder.test.ts
git commit -m "feat(stage-engine): session-recorder helper with ring buffer (ADR-0184)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 1b — Stage-engine hooks

### Task 10: Hook prompt-builder (whisper read + recorder)

**Files:**
- Modify: `services/stage-engine/src/core/prompt-builder.ts`

- [ ] **Step 1: Read current file**

```bash
wc -l services/stage-engine/src/core/prompt-builder.ts
grep -n "return\|export" services/stage-engine/src/core/prompt-builder.ts | tail -10
```

Locate the function that composes the final system prompt + its return statement.

- [ ] **Step 2: Write failing integration test**

```typescript
// services/stage-engine/src/core/prompt-builder.test.ts — add new describe block
describe("promptBuilder + whisper", () => {
  it("injects <admin_note> when unconsumed whisper exists", async () => {
    // Seed whisper row
    await testDb.from("agent_session_whisper").insert({
      session_id: "test-session",
      workspace_id: "test-ws",
      admin_profile_id: "admin-1",
      content: "Bruker mente tirsdag 29. april",
    });
    const result = await buildPrompt({ sessionId: "test-session", workspaceId: "test-ws", ... });
    expect(result.systemPrompt).toContain("<admin_note");
    expect(result.systemPrompt).toContain("Bruker mente tirsdag 29. april");
    expect(result.systemPrompt).toContain("Do NOT quote");
  });

  it("emits recorder turn with phase=prompt_built", async () => {
    const recordSpy = vi.fn();
    await buildPrompt({ sessionId: "s", workspaceId: "w", recorder: { recordTurn: recordSpy } });
    expect(recordSpy).toHaveBeenCalledWith(expect.objectContaining({
      phase: "prompt_built",
      turnKind: expect.any(String),
    }));
  });
});
```

- [ ] **Step 3: Run — expect fail**

```bash
pnpm vitest run services/stage-engine/src/core/prompt-builder.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Modify prompt-builder.ts**

Add whisper read + recorder hook. Insert BEFORE the function returns the assembled prompt:

```typescript
// services/stage-engine/src/core/prompt-builder.ts
// ... existing imports ...
import type { Recorder } from "./session-recorder.js";

// Add to signature (non-breaking via optional):
// async function buildPrompt(opts: { ..., recorder?: Recorder }): Promise<...>

// ADR-0185 — Read unconsumed whispers, wrap in <admin_note>, mark consumed.
const { data: whispers } = await supabase
  .from("agent_session_whisper")
  .select("id, content")
  .eq("session_id", opts.sessionId)
  .eq("is_consumed", false)
  .order("created_at", { ascending: true });

let adminNoteBlock = "";
if (whispers && whispers.length > 0) {
  const notes = whispers.map((w) => w.content).join("\n\n");
  adminNoteBlock = `\n\n<admin_note visibility="internal" from="platform_admin">\n${notes}\n</admin_note>\n\nThis note is internal guidance. Do NOT quote it verbatim to the user. Apply the guidance naturally in your next response.\n`;
  // Mark consumed (fire-and-forget)
  void supabase
    .from("agent_session_whisper")
    .update({ is_consumed: true, consumed_at: new Date().toISOString() })
    .in("id", whispers.map((w) => w.id));
}

const systemPrompt = `${baseSystemPrompt}${adminNoteBlock}`;

// ADR-0184 — Recorder hook
opts.recorder?.recordTurn({
  sessionId: opts.sessionId,
  workspaceId: opts.workspaceId,
  profileId: opts.profileId,
  turnKind: "agent_response",
  phase: "prompt_built",
  content: { systemPrompt, whisper_count: whispers?.length ?? 0 },
  meta: { model: opts.model, git_sha: process.env.GIT_SHA ?? "unknown" },
});

return { systemPrompt, /* ... */ };
```

- [ ] **Step 5: Verify tests pass**

```bash
pnpm vitest run services/stage-engine/src/core/prompt-builder.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/stage-engine/src/core/prompt-builder.ts services/stage-engine/src/core/prompt-builder.test.ts
git commit -m "feat(stage-engine): whisper read + recorder hook in prompt-builder (ADR-0184, ADR-0185)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Hook agent-router (classifier + LLM)

**Files:**
- Modify: `services/stage-engine/src/core/agent-router.ts`

- [ ] **Step 1: Locate hook points**

```bash
grep -n "classifyIntent\|generateText\|streamText" services/stage-engine/src/core/agent-router.ts
```

Expected: find classifyIntent call site (now line ~83) and LLM call site.

- [ ] **Step 2: Add recorder hooks around classifier**

Before:
```typescript
const intent = await classifyIntent(message, context);
```

After:
```typescript
opts.recorder?.recordTurn({
  sessionId, workspaceId, profileId,
  turnKind: "user_input",
  phase: "classifier_input",
  content: { message, context },
});
const intent = await classifyIntent(message, context);
opts.recorder?.recordTurn({
  sessionId, workspaceId, profileId,
  turnKind: "agent_response",
  phase: "classifier_output",
  content: { intent },
});
```

- [ ] **Step 3: Add hooks around LLM call**

Before:
```typescript
const response = await generateText({ model, messages, tools });
```

After:
```typescript
const llmStart = Date.now();
opts.recorder?.recordTurn({
  sessionId, workspaceId, profileId,
  turnKind: "agent_response",
  phase: "llm_request",
  content: { model, messages, tools: tools.map(t => t.name) },
});
const response = await generateText({ model, messages, tools });
opts.recorder?.recordTurn({
  sessionId, workspaceId, profileId,
  turnKind: "agent_response",
  phase: "llm_response",
  content: {
    text: response.text,
    tool_calls: response.toolCalls,
    finish_reason: response.finishReason,
  },
  meta: { latency_ms: Date.now() - llmStart, model },
});
```

- [ ] **Step 4: Typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/stage-engine
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/stage-engine/src/core/agent-router.ts
git commit -m "feat(stage-engine): recorder hooks around classifier + LLM (ADR-0184)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Hook authority + guardian-evaluator + memory-manager

**Files:**
- Modify: `services/stage-engine/src/core/authority.ts`
- Modify: `services/stage-engine/src/core/guardian-evaluator.ts`
- Modify: `services/stage-engine/src/core/memory-manager.ts`

- [ ] **Step 1: authority.ts — record after load**

Find the function that loads authority config (likely `loadAuthority()` or similar). After the DB read:

```typescript
opts.recorder?.recordTurn({
  sessionId, workspaceId, profileId,
  turnKind: "agent_response",
  phase: "authority_load",
  content: { capability, level: authority.level, authority_id: authority.id },
});
```

- [ ] **Step 2: guardian-evaluator.ts — record verdict**

After `evaluateGuardian()` returns verdict:

```typescript
opts.recorder?.recordTurn({
  sessionId, workspaceId, profileId,
  turnKind: "guardian_verdict",
  phase: "guardian_eval",
  content: { verdict, rule_id: verdict.rule_id, severity: verdict.severity },
});
```

- [ ] **Step 3: memory-manager.ts — record read + write**

After each `.select()` on engine_memory:

```typescript
opts.recorder?.recordTurn({
  sessionId, workspaceId, profileId,
  turnKind: "memory_read",
  phase: "context_collect",
  content: { memory_count: memories.length, query: queryText },
});
```

After `.insert()` (post-A3):

```typescript
opts.recorder?.recordTurn({
  sessionId, workspaceId, profileId,
  turnKind: "memory_write",
  phase: "post_turn",
  content: { memory_id: inserted.id, importance: inserted.importance },
});
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=@smartout/stage-engine
git add services/stage-engine/src/core/authority.ts services/stage-engine/src/core/guardian-evaluator.ts services/stage-engine/src/core/memory-manager.ts
git commit -m "feat(stage-engine): recorder hooks in authority/guardian/memory (ADR-0184)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 1c — BFF endpoints

### Task 13: POST `/api/botsson/recorder/flag`

**Files:**
- Create: `apps/web/src/app/api/botsson/recorder/flag/route.ts`
- Test: `apps/web/src/app/api/botsson/recorder/flag/route.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/src/app/api/botsson/recorder/flag/route.test.ts
import { describe, expect, it } from "vitest";
import { POST } from "./route.js";

describe("POST /api/botsson/recorder/flag", () => {
  it("flags a turn and extends retention", async () => {
    const req = new Request("http://localhost/api/botsson/recorder/flag", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "..." },
      body: JSON.stringify({ turn_id: "turn-1", reason: "wrong day selected" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_flagged).toBe(true);
  });

  it("rejects unauthenticated request", async () => {
    const req = new Request("http://localhost/api/botsson/recorder/flag", {
      method: "POST",
      body: JSON.stringify({ turn_id: "t1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects invalid payload", async () => {
    const req = new Request("http://localhost/api/botsson/recorder/flag", {
      method: "POST",
      headers: { cookie: "valid" },
      body: JSON.stringify({ reason: "missing turn_id" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Implement**

```typescript
// apps/web/src/app/api/botsson/recorder/flag/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { emit } from "@smartout/telemetry";

const FlagSchema = z.object({
  turn_id: z.string().uuid(),
  reason: z.string().min(1).max(500).optional(),
});

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = FlagSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });

  // Resolve actor profile_id server-side (ADR-0151)
  const { data: profile } = await supabase
    .from("profile")
    .select("id, workspace_id, role")
    .eq("user_identity_id", user.id)
    .maybeSingle();
  if (!profile || !["admin", "owner"].includes(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: updated, error } = await supabase
    .from("agent_session_recording")
    .update({
      is_flagged: true,
      flag_reason: parsed.data.reason ?? null,
      flagged_by_profile_id: profile.id,
    })
    .eq("id", parsed.data.turn_id)
    .eq("workspace_id", profile.workspace_id)
    .select("id, is_flagged, session_id, workspace_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  emit("recorder.turn_flagged", {
    workspaceId: updated.workspace_id,
    profileId: profile.id,
    turnId: updated.id,
    sessionId: updated.session_id,
    reason: parsed.data.reason ?? "",
  });

  return NextResponse.json(updated);
}
```

- [ ] **Step 3: Verify + commit**

```bash
pnpm vitest run apps/web/src/app/api/botsson/recorder/flag
git add apps/web/src/app/api/botsson/recorder/flag/
git commit -m "feat(bff): recorder flag endpoint (ADR-0184 Q13)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: POST `/api/botsson/recorder/whisper`

**Files:**
- Create: `apps/web/src/app/api/botsson/recorder/whisper/route.ts`

- [ ] **Step 1: Implement**

```typescript
// apps/web/src/app/api/botsson/recorder/whisper/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { emit } from "@smartout/telemetry";

const WhisperSchema = z.object({
  session_id: z.string().uuid(),
  content: z.string().min(1).max(2000),
});

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = WhisperSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profile")
    .select("id, workspace_id, role")
    .eq("user_identity_id", user.id)
    .maybeSingle();
  if (!profile || !["admin", "owner"].includes(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // C4 authority gate — must have recorder.whisper permission
  const { data: authority } = await supabase
    .from("engine_authority_config")
    .select("level")
    .eq("workspace_id", profile.workspace_id)
    .eq("capability", "recorder.whisper")
    .maybeSingle();
  if (!authority || authority.level === "disabled") {
    return NextResponse.json({ error: "whisper disabled for workspace" }, { status: 403 });
  }

  const { data: inserted, error } = await supabase
    .from("agent_session_whisper")
    .insert({
      session_id: parsed.data.session_id,
      workspace_id: profile.workspace_id,
      admin_profile_id: profile.id,
      content: parsed.data.content,
    })
    .select("id, session_id, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  emit("recorder.whisper_created", {
    workspaceId: profile.workspace_id,
    profileId: profile.id,
    sessionId: inserted.session_id,
    whisperId: inserted.id,
  });

  return NextResponse.json(inserted);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/botsson/recorder/whisper/
git commit -m "feat(bff): recorder whisper endpoint (ADR-0185)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: GET `/api/botsson/recorder/sessions/[id]`

**Files:**
- Create: `apps/web/src/app/api/botsson/recorder/sessions/[id]/route.ts`

- [ ] **Step 1: Implement**

```typescript
// apps/web/src/app/api/botsson/recorder/sessions/[id]/route.ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS on agent_session_recording handles workspace + godmode scoping
  const { data: turns, error } = await supabase
    .from("agent_session_recording")
    .select("*")
    .eq("session_id", sessionId)
    .order("turn_index");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!turns || turns.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    session_id: sessionId,
    workspace_id: turns[0]!.workspace_id,
    turn_count: turns.length,
    turns,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/botsson/recorder/sessions/
git commit -m "feat(bff): recorder session dump endpoint (ADR-0184)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: GET `/api/botsson/recorder/break-glass/[envelope_id]`

**Files:**
- Create: `apps/web/src/app/api/botsson/recorder/break-glass/[envelope_id]/route.ts`

- [ ] **Step 1: Implement with audit emit**

```typescript
// apps/web/src/app/api/botsson/recorder/break-glass/[envelope_id]/route.ts
// ADR-0185 § Break-glass — godmode-only PII reveal, audit-logged
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { emit } from "@smartout/telemetry";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ envelope_id: string }> }
) {
  const { envelope_id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: identity } = await supabase
    .from("user_identity")
    .select("id, is_godmode")
    .eq("id", user.id)
    .single();
  if (!identity?.is_godmode) {
    return NextResponse.json({ error: "godmode_required" }, { status: 403 });
  }

  // Decrypt via pgcrypto
  const { data: envelope, error } = await supabase.rpc("decrypt_envelope", {
    p_envelope_id: envelope_id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!envelope) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // MANDATORY: audit-log the reveal
  const { data: profile } = await supabase
    .from("profile")
    .select("id, workspace_id")
    .eq("user_identity_id", user.id)
    .maybeSingle();

  emit("admin.pii_reveal", {
    workspaceId: envelope.workspace_id,
    profileId: profile?.id ?? user.id,
    envelopeId: envelope_id,
    piiClass: envelope.pii_class,
    durationMs: 5000,
  });

  return NextResponse.json({
    raw: envelope.raw,
    pii_class: envelope.pii_class,
    auto_redact_in_ms: 5000,
  });
}
```

- [ ] **Step 2: Add `decrypt_envelope` RPC migration**

Create `supabase/migrations/<ts+5>_decrypt_envelope_rpc.sql`:

```sql
CREATE OR REPLACE FUNCTION public.decrypt_envelope(p_envelope_id uuid)
RETURNS TABLE (raw text, pii_class text, workspace_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be godmode (enforced by BFF; RLS on envelope table already checks)
  RETURN QUERY
  SELECT
    convert_from(
      pgp_sym_decrypt(e.encrypted_payload, current_setting('app.envelope_key')),
      'utf8'
    )::text AS raw,
    e.pii_class,
    e.workspace_id
  FROM public.agent_session_envelope e
  WHERE e.id = p_envelope_id
    AND e.redact_after > now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decrypt_envelope FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_envelope TO authenticated;
```

**Note:** `app.envelope_key` must be set via Supabase config per-environment. Key managed in 1Password `smartout_ai_prod/envelope_key` (secrets-protocol).

- [ ] **Step 3: Apply + commit**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<ts+5>_decrypt_envelope_rpc.sql
git add apps/web/src/app/api/botsson/recorder/break-glass/ supabase/migrations/<ts+5>_decrypt_envelope_rpc.sql
git commit -m "feat(bff): break-glass PII reveal with audit (ADR-0185)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 1d — Platform Admin UI

### Task 17: `useRecorderSessions` Realtime hook

**Files:**
- Create: `apps/web/src/app/platform-admin/guardian/_hooks/useRecorderSessions.ts`

- [ ] **Step 1: Implement**

```typescript
// apps/web/src/app/platform-admin/guardian/_hooks/useRecorderSessions.ts
"use client";
import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { Database } from "@smartout/supabase";

type Turn = Database["public"]["Tables"]["agent_session_recording"]["Row"];

type SessionRow = {
  session_id: string;
  workspace_id: string;
  turn_count: number;
  last_turn_at: string;
  flagged_count: number;
  max_attention_score: number;
};

export function useRecorderSessions(workspaceId?: string) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabase();

    async function load() {
      let query = supabase
        .from("agent_session_recording")
        .select("session_id, workspace_id, is_flagged, attention_score, created_at");
      if (workspaceId) query = query.eq("workspace_id", workspaceId);
      const { data } = await query.order("created_at", { ascending: false }).limit(500);
      if (!data) return;

      const grouped = new Map<string, SessionRow>();
      for (const r of data) {
        const ex = grouped.get(r.session_id);
        if (ex) {
          ex.turn_count++;
          if (r.is_flagged) ex.flagged_count++;
          ex.max_attention_score = Math.max(ex.max_attention_score, Number(r.attention_score ?? 0));
          if (r.created_at > ex.last_turn_at) ex.last_turn_at = r.created_at;
        } else {
          grouped.set(r.session_id, {
            session_id: r.session_id,
            workspace_id: r.workspace_id,
            turn_count: 1,
            last_turn_at: r.created_at,
            flagged_count: r.is_flagged ? 1 : 0,
            max_attention_score: Number(r.attention_score ?? 0),
          });
        }
      }
      setSessions([...grouped.values()].sort((a, b) => b.last_turn_at.localeCompare(a.last_turn_at)));
      setLoading(false);
    }

    void load();

    const channel = supabase
      .channel("recorder-sessions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_session_recording",
          filter: workspaceId ? `workspace_id=eq.${workspaceId}` : undefined,
        },
        () => void load()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  return { sessions, loading };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/guardian/_hooks/useRecorderSessions.ts
git commit -m "feat(platform-admin): Realtime recorder sessions hook (ADR-0184 Q6b)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: `RedactedPill` component

**Files:**
- Create: `apps/web/src/app/platform-admin/guardian/_components/RedactedPill.tsx`

- [ ] **Step 1: Implement per Nordic Split + Frontend Designer spec**

```typescript
// apps/web/src/app/platform-admin/guardian/_components/RedactedPill.tsx
"use client";
import { Shield } from "lucide-react";

type RedactedPillProps = {
  piiClass: string;
  envelopeId?: string | null;
  onReveal?: () => void;
};

export function RedactedPill({ piiClass, envelopeId, onReveal }: RedactedPillProps) {
  const canReveal = Boolean(envelopeId && onReveal);
  return (
    <span
      className="bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-sm font-mono text-[0.85em] inline-flex items-center gap-1"
      title={canReveal ? "Hover for å vise (5s)" : "Redacted by policy"}
    >
      <Shield className="h-2.5 w-2.5" />
      <span>‹{piiClass}›</span>
      {canReveal && (
        <button
          onClick={onReveal}
          className="text-[0.9em] underline-offset-2 hover:underline opacity-60 hover:opacity-100 transition-opacity"
          type="button"
        >
          Vis (5s)
        </button>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/guardian/_components/RedactedPill.tsx
git commit -m "feat(platform-admin): RedactedPill component (ADR-0185, Nordic Split)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: `TurnCard` + `TurnTimeline`

**Files:**
- Create: `apps/web/src/app/platform-admin/guardian/_components/TurnCard.tsx`
- Create: `apps/web/src/app/platform-admin/guardian/_components/TurnTimeline.tsx`

- [ ] **Step 1: Implement `TurnCard`**

```typescript
// apps/web/src/app/platform-admin/guardian/_components/TurnCard.tsx
"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronDown, Flag } from "lucide-react";
import type { Database } from "@smartout/supabase";

type Turn = Database["public"]["Tables"]["agent_session_recording"]["Row"];

export function TurnCard({ turn, onFlag }: { turn: Turn; onFlag?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const verdictColor =
    turn.turn_kind === "guardian_verdict" && (turn.content_redacted as any)?.verdict?.severity === "block"
      ? "bg-destructive/10 text-destructive"
      : turn.is_flagged
        ? "bg-amber-500/10 text-amber-700"
        : "bg-muted/40 text-muted-foreground";

  return (
    <motion.div
      layout
      className="group relative border-border/30 border rounded-lg bg-card/60 mb-2"
      transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2 flex items-center gap-2"
      >
        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-mono ${verdictColor}`}>
          {turn.phase}
        </span>
        <span className="text-xs text-muted-foreground">#{turn.turn_index}</span>
        <span className="text-xs flex-1 truncate">
          {JSON.stringify(turn.content_redacted).slice(0, 80)}
        </span>
        {turn.attention_score && Number(turn.attention_score) > 0.7 && (
          <span className="text-[10px] font-semibold text-amber-700">⚠ {turn.attention_score}</span>
        )}
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {onFlag && (
        <button
          onClick={() => onFlag(turn.id)}
          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          aria-label="Flag"
        >
          <Flag className="h-3.5 w-3.5 text-muted-foreground hover:text-amber-600" />
        </button>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 40, damping: 22 }}
            className="overflow-hidden"
          >
            <pre className="text-[11px] font-mono p-3 bg-muted/20 overflow-x-auto">
              {JSON.stringify(turn.content_redacted, null, 2)}
            </pre>
            {turn.meta && Object.keys(turn.meta).length > 0 && (
              <div className="px-3 pb-2 text-[10px] text-muted-foreground">
                {Object.entries(turn.meta).map(([k, v]) => (
                  <span key={k} className="mr-3">
                    <span className="font-semibold">{k}:</span> {JSON.stringify(v)}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

- [ ] **Step 2: Implement `TurnTimeline`**

```typescript
// apps/web/src/app/platform-admin/guardian/_components/TurnTimeline.tsx
"use client";
import { useEffect, useState } from "react";
import { TurnCard } from "./TurnCard";
import type { Database } from "@smartout/supabase";

type Turn = Database["public"]["Tables"]["agent_session_recording"]["Row"];

export function TurnTimeline({ sessionId }: { sessionId: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/botsson/recorder/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        setTurns(d.turns ?? []);
        setLoading(false);
      });
  }, [sessionId]);

  const handleFlag = async (turnId: string) => {
    const reason = window.prompt("Hvorfor flagger du denne?");
    if (!reason) return;
    await fetch("/api/botsson/recorder/flag", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ turn_id: turnId, reason }),
    });
    // Reload
    fetch(`/api/botsson/recorder/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((d) => setTurns(d.turns ?? []));
  };

  if (loading) return <p className="text-muted-foreground text-sm">Laster...</p>;
  if (turns.length === 0) return <p className="text-muted-foreground text-sm">Ingen turns.</p>;

  return (
    <div className="space-y-1 max-h-[70vh] overflow-y-auto">
      {turns.map((t) => (
        <TurnCard key={t.id} turn={t} onFlag={handleFlag} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/guardian/_components/TurnCard.tsx apps/web/src/app/platform-admin/guardian/_components/TurnTimeline.tsx
git commit -m "feat(platform-admin): TurnTimeline + TurnCard components (ADR-0184)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 20: `AdminActionDrawer` (whisper + flag + force-stop)

**Files:**
- Create: `apps/web/src/app/platform-admin/guardian/_components/AdminActionDrawer.tsx`

- [ ] **Step 1: Implement**

```typescript
// apps/web/src/app/platform-admin/guardian/_components/AdminActionDrawer.tsx
"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { X, MessageSquare, Flag, StopCircle } from "lucide-react";

type Props = {
  sessionId: string;
  open: boolean;
  onClose: () => void;
};

export function AdminActionDrawer({ sessionId, open, onClose }: Props) {
  const [whisperText, setWhisperText] = useState("");
  const [stopping, setStopping] = useState(false);
  const [stopProgress, setStopProgress] = useState(0);

  const submitWhisper = async () => {
    if (!whisperText.trim()) return;
    await fetch("/api/botsson/recorder/whisper", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, content: whisperText }),
    });
    setWhisperText("");
  };

  const startForceStop = () => {
    setStopping(true);
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / 800);
      setStopProgress(p);
      if (p < 1 && stopping) requestAnimationFrame(tick);
      if (p >= 1) {
        void fetch(`/api/botsson/recorder/force-stop`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        setStopping(false);
        setStopProgress(0);
      }
    };
    requestAnimationFrame(tick);
  };

  const cancelForceStop = () => {
    setStopping(false);
    setStopProgress(0);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 bottom-0 w-[520px] bg-background border-l border-border z-50"
            initial={{ x: 520 }}
            animate={{ x: 0 }}
            exit={{ x: 520 }}
            transition={{ type: "spring", stiffness: 40, damping: 22, mass: 2.2 }}
          >
            <div className="p-6 h-full flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-xl">Session Admin</h2>
                <button onClick={onClose} aria-label="Lukk"><X className="h-4 w-4" /></button>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Whisper til Emma
                </label>
                <textarea
                  value={whisperText}
                  onChange={(e) => setWhisperText(e.target.value)}
                  placeholder="Skriv en instruks som bli injisert i neste turn..."
                  className="w-full min-h-[100px] bg-card border border-border rounded-md p-2 text-sm"
                />
                <button
                  onClick={submitWhisper}
                  disabled={!whisperText.trim()}
                  className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium disabled:opacity-50"
                >
                  Send whisper
                </button>
              </div>

              <div className="space-y-2 pt-4 border-t border-border">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Flag className="h-3 w-3" /> Flag session
                </label>
                <button
                  onClick={async () => {
                    const reason = window.prompt("Hvorfor flagge?");
                    if (!reason) return;
                    // Flag latest turn — backend resolves
                    await fetch("/api/botsson/recorder/flag-session", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ session_id: sessionId, reason }),
                    });
                  }}
                  className="w-full bg-amber-500/10 text-amber-700 rounded-md py-2 text-sm font-medium hover:bg-amber-500/20"
                >
                  Flag hele sesjonen
                </button>
              </div>

              <div className="space-y-2 pt-4 border-t border-border mt-auto">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <StopCircle className="h-3 w-3" /> Force-stop (hold 800ms)
                </label>
                <button
                  onMouseDown={startForceStop}
                  onMouseUp={cancelForceStop}
                  onMouseLeave={cancelForceStop}
                  className="w-full bg-destructive/10 text-destructive rounded-md py-2 text-sm font-medium relative overflow-hidden"
                >
                  <span className="relative z-10">Hold for å stoppe</span>
                  {stopping && (
                    <span
                      className="absolute inset-0 bg-destructive/30 origin-left"
                      style={{ transform: `scaleX(${stopProgress})` }}
                    />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/guardian/_components/AdminActionDrawer.tsx
git commit -m "feat(platform-admin): AdminActionDrawer with whisper/flag/force-stop (ADR-0185)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 21: Extend `SessionList` with recorder columns

**Files:**
- Modify: `apps/web/src/app/platform-admin/guardian/_components/SessionList.tsx`

- [ ] **Step 1: Add new columns**

Read current file; add `turn_count`, `flagged_count`, `max_attention_score` columns to the table. Use `useRecorderSessions()` hook to source data when `useGuardianSocket` lacks historical data.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/guardian/_components/SessionList.tsx
git commit -m "feat(platform-admin): extend SessionList with recorder columns (ADR-0184)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 22: Arena LogView hover-flag affordance

**Files:**
- Modify: `apps/web/src/app/Botsson/_components/BotssonArena.tsx` (LogView region, line ~2140)

- [ ] **Step 1: Locate LogView**

```bash
grep -n "function LogView" apps/web/src/app/Botsson/_components/BotssonArena.tsx
```

- [ ] **Step 2: Add hover-flag to per-turn rows**

Inside each row render of LogView, add:

```tsx
<button
  onClick={async () => {
    const reason = window.prompt("Send til Platform Admin?");
    if (!reason) return;
    await fetch("/api/botsson/recorder/flag", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ turn_id: entry.turnId, reason }),
    });
  }}
  className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
  aria-label="Flag til Platform Admin"
>
  <FlagIcon className="h-3.5 w-3.5 text-muted-foreground" />
</button>
```

Wrap parent row with `className="... group relative"` if not already.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/Botsson/_components/BotssonArena.tsx
git commit -m "feat(arena): LogView hover-flag affordance to recorder (ADR-0184 Q13)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 1e — E2E + docs + gate

### Task 23: E2E — Schedule wrong-day replay (acceptance Q17)

**Files:**
- Create: `apps/e2e/tests/botsson-recorder/schedule-wrong-day-replay.spec.ts`

- [ ] **Step 1: Write**

```typescript
// apps/e2e/tests/botsson-recorder/schedule-wrong-day-replay.spec.ts
import { test, expect } from "@playwright/test";

test("admin replays schedule wrong-day bug via Platform Admin Guardian", async ({ page }) => {
  // Seed: simulate an Emma session with a schedule.shift_created tool call on wrong day
  await page.goto("/platform-admin/guardian");

  // Filter workspace + date + tool
  await page.getByLabel("Workspace").selectOption("test-workspace");
  await page.getByLabel("Tool filter").fill("schedule.shift_created");
  await page.getByRole("button", { name: "Apply filter" }).click();

  // Session list shows row within 2s (Realtime)
  await expect(page.getByRole("row").filter({ hasText: "schedule.shift_created" })).toBeVisible({ timeout: 2000 });

  // Drill into session details
  await page.getByRole("row").first().click();

  // TurnTimeline visible
  const timeline = page.getByTestId("turn-timeline");
  await expect(timeline).toBeVisible();

  // Expand a turn — verify payload contains user message, classifier, LLM response, tool call
  await timeline.getByRole("button").first().click();
  await expect(timeline.getByText(/classifier_output/)).toBeVisible();
  await expect(timeline.getByText(/llm_response/)).toBeVisible();
  await expect(timeline.getByText(/schedule\.shift_created/)).toBeVisible();

  // Flag the turn
  page.on("dialog", (d) => d.accept("wrong date selected"));
  await timeline.getByRole("button", { name: "Flag" }).first().click();

  // Verify retention-extended visual signal (amber flag icon)
  await expect(timeline.getByText(/is_flagged.*true/i).first()).toBeVisible();

  // Open drawer, write whisper
  await page.getByRole("button", { name: /admin/i }).click();
  await page.getByPlaceholder(/Skriv en instruks/).fill("Bruker mente tirsdag 29. april");
  await page.getByRole("button", { name: "Send whisper" }).click();

  // Verify whisper persisted
  await expect(page.getByText(/whisper sent/i)).toBeVisible({ timeout: 3000 });
});
```

- [ ] **Step 2: Run**

```bash
pnpm e2e apps/e2e/tests/botsson-recorder/schedule-wrong-day-replay.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/tests/botsson-recorder/schedule-wrong-day-replay.spec.ts
git commit -m "test(e2e): schedule wrong-day replay acceptance (ADR-0184 Q17)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 24: E2E — Whisper never user-facing (ADR-0078 enforcement)

**Files:**
- Create: `apps/e2e/tests/botsson-recorder/whisper-never-user-facing.spec.ts`

- [ ] **Step 1: Write**

```typescript
// apps/e2e/tests/botsson-recorder/whisper-never-user-facing.spec.ts
import { test, expect } from "@playwright/test";

test("whisper content never appears in assistant response to user", async ({ page, context }) => {
  // Admin writes whisper with highly distinct token
  const WHISPER_TOKEN = "XYZ_WHISPER_PROBE_42";
  await page.goto("/platform-admin/guardian");
  await page.getByRole("row").first().click();
  await page.getByRole("button", { name: /admin/i }).click();
  await page.getByPlaceholder(/Skriv en instruks/).fill(`Husk denne tokenen: ${WHISPER_TOKEN}`);
  await page.getByRole("button", { name: "Send whisper" }).click();

  // Open user-facing Botsson Arena in new tab
  const userPage = await context.newPage();
  await userPage.goto("/dashboard");
  await userPage.getByRole("button", { name: /botsson/i }).click();

  // User sends message, triggers next turn
  await userPage.getByRole("textbox").fill("Hei Emma, hva kan du hjelpe med?");
  await userPage.getByRole("button", { name: /send/i }).click();

  // Wait for agent response
  await userPage.waitForSelector("[data-role='agent']", { timeout: 15000 });

  // Verify response NEVER contains the whisper token
  const responseText = await userPage.locator("[data-role='agent']").last().textContent();
  expect(responseText).not.toContain(WHISPER_TOKEN);

  // Also check full DOM (defense in depth)
  const fullPage = await userPage.content();
  expect(fullPage).not.toContain(WHISPER_TOKEN);
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/e2e/tests/botsson-recorder/whisper-never-user-facing.spec.ts
git commit -m "test(e2e): whisper never leaks to user (ADR-0078, ADR-0185)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 25: E2E — Recorder failure resilience

**Files:**
- Create: `apps/e2e/tests/botsson-recorder/recorder-failure-resilience.spec.ts`

- [ ] **Step 1: Write**

```typescript
// apps/e2e/tests/botsson-recorder/recorder-failure-resilience.spec.ts
import { test, expect } from "@playwright/test";

test("Emma keeps working when recorder DB is down", async ({ page }) => {
  // Admin toggle: simulate recorder DB failure via env flag
  await page.goto("/platform-admin/debug");
  await page.getByLabel("Simulate recorder failure").check();

  // User starts a session
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /botsson/i }).click();
  await page.getByRole("textbox").fill("Hei");
  await page.getByRole("button", { name: /send/i }).click();

  // Response arrives normally
  const response = await page.locator("[data-role='agent']").last();
  await expect(response).toBeVisible({ timeout: 15000 });

  // Drop-count metric accessible via debug endpoint
  const metrics = await page.request.get("/api/botsson/recorder/_metrics");
  const body = await metrics.json();
  expect(body.error_count).toBeGreaterThan(0);
  expect(body.recorder_blocking_emma).toBe(false);
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/e2e/tests/botsson-recorder/recorder-failure-resilience.spec.ts
git commit -m "test(e2e): recorder never blocks Emma on DB failure (ADR-0184 Q8b)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 26: Update BOTSSON-SYSTEM-MAP

**Files:**
- Modify: `docs/architecture/BOTSSON-SYSTEM-MAP.md`

- [ ] **Step 1: Update D1 + add recorder rows**

Find the D1 row (🔴 `agent_session_recording` tabell finnes ikke). Change to 🟢 with note "Landed via ADR-0184 + 0185 — see `docs/superpowers/specs/2026-04-22-session-recorder-platform-admin-design.md`".

Add new rows:
- L3 Session Recorder helper (`session-recorder.ts`) 🟢
- L2 BFF `/api/botsson/recorder/*` 🟢
- L5 `agent_session_recording`, `agent_session_envelope`, `agent_session_whisper` 🟢
- Platform Admin UI extensions 🟢

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/BOTSSON-SYSTEM-MAP.md
git commit -m "docs(map): D1 recorder + admin intervention 🟢 (ADR-0184, ADR-0185)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 27: Update Campaign + accept ADRs

**Files:**
- Modify: `docs/plans/CAMPAIGN-botsson-arena.md`
- Modify: `docs/decisions/0184-session-recorder.md` — status proposed → accepted
- Modify: `docs/decisions/0185-platform-admin-session-intervention.md` — status proposed → accepted

- [ ] **Step 1: Mark Phase D1 complete in CAMPAIGN**

Add new Phase D section with D1 ✓, D2 (schedule diagnostics) pending.

- [ ] **Step 2: Flip ADR status**

Edit frontmatter `status: proposed` → `status: accepted` on both ADRs.

- [ ] **Step 3: Commit**

```bash
git add docs/plans/CAMPAIGN-botsson-arena.md docs/decisions/0184-session-recorder.md docs/decisions/0185-platform-admin-session-intervention.md
git commit -m "docs(campaign): Phase D1 complete + ADR-0184/0185 accepted

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 28: Write journey stub

**Files:**
- Create: `docs/journeys/JOURNEY-session-recorder-platform-admin.md`

- [ ] **Step 1: Write 4 journeys per spec §11**

```markdown
---
title: "Journey — Session Recorder + Platform Admin Intervention"
status: draft
updated: 2026-04-22
created: 2026-04-22
module: MODULE_BOTSSON
tags: [journey, botsson, platform-admin]
---

# Journeys

## Journey 1: Admin triages a buggy session
**Precondition:** Platform Admin logged in, workspace has recent flagged session.
1. Admin opens `/platform-admin/guardian` → System shows SessionList sorted by attention_score → Admin sees flagged row at top
2. Admin clicks row → System navigates to SessionDetails → Admin sees TurnTimeline
3. Admin expands a turn → System renders full payload → Admin identifies wrong tool call
4. Admin opens AdminActionDrawer → Admin types whisper → System POSTs to `/api/botsson/recorder/whisper`
5. Admin flags turn → System marks is_flagged=true, extends retention
**Postcondition:** Whisper queued for next turn; turn flagged; Emma's next response honors whisper.
**Error paths:** Session has no turns (404), whisper > 2000 chars (400 validation), admin not in workspace (403).

## Journey 2: Platform Admin break-glass PII reveal
**Precondition:** Admin has is_godmode, session contains <personnummer> pill.
1. Admin hovers pill → System shows "Vis (5s)" button
2. Admin clicks → System GET `/api/botsson/recorder/break-glass/<envelope_id>` → Pill reveals raw value for 5s
3. 5s passes → System auto-redacts → admin.pii_reveal event in activity_trail
**Postcondition:** Audit trail has reveal event; envelope contents viewed.
**Error paths:** Envelope expired (404), not godmode (403), envelope key misconfigured (500).

## Journey 3: Developer replays schedule wrong-day bug
**Precondition:** User reported bug with session_id.
1. Developer GET `/api/botsson/recorder/sessions/<id>` → Returns JSON with all turns
2. Developer diffs against known-good session → Identifies timezone bug in classifier context
**Postcondition:** Root cause identified; fix PR referenced in flag comment.
**Error paths:** Session not found (404), unauthenticated (401).

## Journey 4: End-user flags turn from Arena LogView
**Precondition:** User opens Botsson Arena → Log view, sees suspicious turn.
1. User hovers row → System reveals Flag icon (opacity 0→100 200ms)
2. User clicks → System shows inline confirm "Send til Platform Admin?"
3. User confirms → System POSTs to `/api/botsson/recorder/flag`
**Postcondition:** Turn is_flagged=true, Platform Admin sees in SessionList within 2s (Realtime).
**Error paths:** Network fails (show toast + retry), user not admin (403).
```

- [ ] **Step 2: Commit**

```bash
git add docs/journeys/JOURNEY-session-recorder-platform-admin.md
git commit -m "docs(journeys): session recorder + platform admin intervention

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 29: Typecheck + final verification

- [ ] **Step 1: Run full typecheck**

```bash
pnpm turbo typecheck
```

Expected: PASS 0 errors.

- [ ] **Step 2: Run all new tests**

```bash
pnpm vitest run packages/ai/src/lib/pii-redact.test.ts packages/ai/src/lib/attention-score.test.ts services/stage-engine/src/core/session-recorder.test.ts
```

Expected: PASS all.

- [ ] **Step 3: Run E2E suite**

```bash
pnpm e2e apps/e2e/tests/botsson-recorder/
```

Expected: PASS all 3 specs.

- [ ] **Step 4: Verify BOTSSON-SYSTEM-MAP consistency**

```bash
grep -n "🔴.*agent_session_recording\|🔴.*Session Recorder" docs/architecture/BOTSSON-SYSTEM-MAP.md
```

Expected: 0 matches (all 🟢 after this plan).

---

## Self-Review

**Spec coverage check:**
- ✅ §3.1 schema — Tasks 1-5 (3 tables + authority + cron)
- ✅ §3.2 capture points — Tasks 10-12 (prompt-builder, agent-router, authority, guardian, memory)
- ✅ §3.3 redaction — Task 7
- ✅ §3.4 Realtime transport — Task 17
- ✅ §3.5 authority — Task 4 seed + Tasks 13-16 BFF gate checks
- ✅ §3.6 Platform Admin UI — Tasks 18-21
- ✅ §3.7 Arena bug-report — Task 22
- ✅ §4 Phase 1 deliverables all covered
- ✅ §6 acceptance tests — Tasks 23-25
- ✅ §11 journeys — Task 28

**Placeholder scan:** None. Every step has actual code/commands.

**Type consistency:**
- `RecordTurnInput` used in Task 9 matches hooks in Tasks 10-12 ✅
- `agent_session_recording` columns consistent across migration (Task 1) and writes (Task 9) ✅
- `turn_kind` enum values match CHECK constraint in migration and TypeScript type ✅

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-22-session-recorder-platform-admin.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task via `superpowers:subagent-driven-development`. Two-stage review per task. Best for: catching integration issues early, maintaining clean context per task. Slower wall-clock but higher quality.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`. Batch execution with checkpoint pauses. Faster but risks context bloat over 29 tasks.

**My recommendation: Subagent-Driven.** 29 tasks with migrations, hooks, UI, and E2E. Too much for one context.

**But first:** Phase 0 gate must be verified. A3 (memory-writer), A5 (intent-classifier context), A6 (guardian-bus pg_notify) must all be 🟢 in `BOTSSON-SYSTEM-MAP.md` before any task below executes. Per L-0109 this is non-negotiable.

**Which approach, and is Phase 0 ready?**
