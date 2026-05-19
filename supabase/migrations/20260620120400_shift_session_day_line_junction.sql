-- supabase/migrations/20260620120400_shift_session_day_line_junction.sql
-- ADR-0367 §4.3. M:N — shift_session can span multiple day_lines (multi-area shifts).

CREATE TABLE public.shift_session_day_line (
  shift_session_id  UUID NOT NULL REFERENCES shift_session(shift_session_id) ON DELETE CASCADE,
  day_line_id       UUID NOT NULL REFERENCES day_line(day_line_id) ON DELETE CASCADE,
  PRIMARY KEY (shift_session_id, day_line_id)
);

CREATE INDEX idx_ssdl_day_line ON shift_session_day_line (day_line_id);

-- Junction inherits parent RLS — readers go through shift_session SELECT path.
ALTER TABLE shift_session_day_line ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_ssdl" ON shift_session_day_line FOR SELECT
USING (
  shift_session_id IN (
    SELECT shift_session_id FROM shift_session
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  )
);

CREATE POLICY "service_role_ssdl" ON shift_session_day_line FOR ALL
USING (auth.role() = 'service_role');
