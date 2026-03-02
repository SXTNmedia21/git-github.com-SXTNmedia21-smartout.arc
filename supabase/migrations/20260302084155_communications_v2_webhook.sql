-- Communications v2: counter increment function for webhook events

CREATE OR REPLACE FUNCTION increment_communication_counter(
  p_communication_id uuid,
  p_field text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_field = 'opened_count' THEN
    UPDATE platform_communication_log
    SET opened_count = opened_count + 1, updated_at = now()
    WHERE communication_id = p_communication_id;
  ELSIF p_field = 'clicked_count' THEN
    UPDATE platform_communication_log
    SET clicked_count = clicked_count + 1, updated_at = now()
    WHERE communication_id = p_communication_id;
  END IF;
END;
$$;
