-- 20260515120600_decrypt_envelope_rpc.sql
-- ADR-0185 § Break-glass — SECURITY DEFINER decryption RPC for godmode PII reveal.
--
-- L-0042 timestamp verified: tip 20260515120500, depends on:
--   - agent_session_envelope (20260515120200) — table + encrypted_payload + pii_class
--   - pgcrypto extension (enabled by 20260515120200)
--
-- The BFF /api/botsson/recorder/break-glass/[envelope_id] endpoint enforces
-- godmode on the caller (via BFF-level user_identity.is_godmode check) and
-- audit-logs every call via emit("admin.pii_reveal"). RLS on
-- agent_session_envelope already restricts SELECT to godmode callers, so this
-- RPC's SECURITY DEFINER is defence-in-depth — it still honours the
-- redact_after cutoff, returning nothing once the envelope's retention has
-- expired.
--
-- Envelope key handling: the symmetric key lives in current_setting('app.envelope_key').
-- The key must be configured per-environment (Supabase Local: via psql SET;
-- Supabase Cloud: via Dashboard > Database > Configuration > Custom Config
-- with `ALTER DATABASE ... SET app.envelope_key = ...`). Key value is stored
-- in 1Password (smartout_ai_prod/envelope_key per secrets-protocol). The RPC
-- itself contains NO key material.
--
-- Caller: BFF-only. REVOKE from PUBLIC, GRANT to authenticated (the BFF uses
-- the caller's JWT). Service role bypass still works for admin tooling.

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.decrypt_envelope(p_envelope_id uuid)
RETURNS TABLE (
  raw          text,
  pii_class    text,
  workspace_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Returns nothing if:
  --   (a) envelope does not exist, OR
  --   (b) redact_after has passed (tiered retention — ADR-0184 § Retention).
  -- The BFF surfaces this as 404.
  RETURN QUERY
  SELECT
    convert_from(
      pgp_sym_decrypt(
        e.encrypted_payload,
        current_setting('app.envelope_key')
      ),
      'utf8'
    )::text AS raw,
    e.pii_class,
    e.workspace_id
  FROM public.agent_session_envelope e
  WHERE e.id = p_envelope_id
    AND e.redact_after > now();
END;
$$;

COMMENT ON FUNCTION public.decrypt_envelope(uuid) IS
  'ADR-0185 § Break-glass: decrypts an envelope only if retention has not expired. BFF-only, audit-logged at the call site via emit(admin.pii_reveal).';

-- Principle of least privilege: explicit revoke + grant only to authenticated.
-- Anonymous callers cannot invoke this; service role retains its implicit access.
REVOKE EXECUTE ON FUNCTION public.decrypt_envelope(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_envelope(uuid) TO authenticated;
