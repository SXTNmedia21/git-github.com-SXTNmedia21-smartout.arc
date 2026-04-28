-- ADR-0217: journey_guide — dedicated DB table for USER-GUIDE artefacts.
--
-- Decision drivers (ADR-0217):
--   - Uniform workspace_id RLS — same JWT-claim pattern as all engine tables.
--   - Transactional consistency with engine schema — one INSERT, trivially atomic.
--   - Queryability — admin UI lists guides via .from("journey_guide").select(...)
--     with no Storage API / sidecar join.
--   - Content size ≤ 32 KB; DB TEXT with TOAST is cost-free at this scale.
--
-- Schema invariants:
--   - UNIQUE (journey_version_id) — one guide per version snapshot; re-publish
--     upserts (ON CONFLICT DO UPDATE).
--   - UNIQUE (workspace_id, slug, version_number) — supports URL routing
--     /guides/<slug>/v<version_number> without table scans.
--   - CHECK (length(mdx_content) < 1048576) — 1 MB cap per ADR-0217 risk note.
--   - is_public BOOLEAN — controls anonymous read policy.
--
-- RLS model (ADR-0217 §RLS Model):
--   1. workspace_member_read  — JWT workspace_id match → SELECT (workspace members).
--   2. public_guide_read      — is_public = true → SELECT (anonymous readers).
--   3. api_key_read           — get_api_workspace_id() match → SELECT (API key path).
--   4. service_role_write     — auth.role() = 'service_role' → ALL mutations
--      (capability tool runs via ctx.supabaseAdmin = service role).
--
-- updated_at trigger: uses the shared set_updated_at() function established
-- by 00002_structure_tables.sql (exists in every DB this runs against).
--
-- Binding ADRs:
--   - ADR-0217 (journey_guide storage decision)
--   - ADR-0004 / ADR-0054 (dual-auth RLS pattern)
--   - ADR-0176 (C4 capability mutations via service role)
--   - L-0042 (migration timestamp ordering — tip is 20260518220000)

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE journey_guide (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  journey_version_id  UUID NOT NULL REFERENCES journey_version(journey_version_id) ON DELETE CASCADE,
  journey_id          UUID NOT NULL REFERENCES journey(journey_id) ON DELETE CASCADE,
  slug                TEXT NOT NULL,
  version_number      INTEGER NOT NULL,
  title               TEXT NOT NULL,
  mdx_content         TEXT NOT NULL CHECK (length(mdx_content) < 1048576),
  is_public           BOOLEAN NOT NULL DEFAULT false,
  created_by          UUID REFERENCES profile(profile_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (journey_version_id),
  UNIQUE (workspace_id, slug, version_number)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Support admin UI: list all guides for a workspace ordered by created_at DESC.
CREATE INDEX idx_journey_guide_workspace ON journey_guide(workspace_id, created_at DESC);

-- Support URL routing: /guides/<slug>/v<version_number>.
CREATE INDEX idx_journey_guide_slug ON journey_guide(workspace_id, slug, version_number DESC);

-- ── Updated_at trigger ───────────────────────────────────────────────────────

CREATE TRIGGER set_journey_guide_updated_at
  BEFORE UPDATE ON journey_guide
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE journey_guide ENABLE ROW LEVEL SECURITY;

-- 1. Workspace members read their workspace's guides (private or public).
--    Uses the JWT workspace_id claim — matches all other engine tables.
CREATE POLICY "workspace_member_read" ON journey_guide
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

-- 2. Public guides are readable without auth (anonymous + authenticated).
--    is_public = false rows are never surfaced to unauthenticated callers.
CREATE POLICY "public_guide_read" ON journey_guide
  FOR SELECT USING (is_public = true);

-- 3. API key path (service-role-equivalent for API key callers).
CREATE POLICY "api_key_read" ON journey_guide
  FOR SELECT USING (
    workspace_id = get_api_workspace_id()
  );

-- 4. Service-role path — capability tool body runs via ctx.supabaseAdmin
--    which bypasses JWT. This policy authorises INSERT/UPDATE for the
--    publish_guide capability tool (ADR-0217 write path, ADR-0176).
CREATE POLICY "service_role_write" ON journey_guide
  FOR ALL USING (auth.role() = 'service_role');
