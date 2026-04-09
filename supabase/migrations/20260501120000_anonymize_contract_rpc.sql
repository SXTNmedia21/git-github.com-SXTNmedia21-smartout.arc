-- anonymize_contract: anonymize declined/expired contracts after 3 years
-- Compliance: bokforingsloven + GDPR retention rules
CREATE OR REPLACE FUNCTION anonymize_contract(p_contract_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE employment_contract SET
    framework_snapshot = NULL,
    compliance_overrides = '[]'::jsonb,
    decline_reason_text = '[anonymized]',
    updated_at = now()
  WHERE contract_id = p_contract_id
    AND status IN ('declined', 'expired')
    AND created_at < now() - interval '3 years';
END;
$$;

GRANT EXECUTE ON FUNCTION anonymize_contract(UUID) TO service_role;

COMMENT ON FUNCTION anonymize_contract IS
  'Anonymize declined/expired contracts after 3-year retention. Clears framework_snapshot, compliance_overrides, and decline_reason_text.';
