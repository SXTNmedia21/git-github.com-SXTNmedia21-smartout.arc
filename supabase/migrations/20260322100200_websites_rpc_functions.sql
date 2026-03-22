BEGIN;

-- Public site read: returns active snapshot for a hostname
CREATE OR REPLACE FUNCTION websites.get_active_site_snapshot_by_host(p_host text)
RETURNS jsonb AS $$
  SELECT ws.snapshot_data
  FROM websites.website_published_snapshot ws
  JOIN websites.website_domain wd ON wd.website_id = ws.website_id
  WHERE wd.domain = p_host
    AND wd.status = 'active'
    AND wd.deleted_at IS NULL
    AND ws.is_active = true
    AND ws.deleted_at IS NULL
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = websites, public;

-- Preview read: returns draft data for a valid, non-expired, pinned token
CREATE OR REPLACE FUNCTION websites.get_preview_site_by_token(p_token text)
RETURNS jsonb AS $$
  SELECT dr.draft_data
  FROM websites.website_preview_session ps
  JOIN websites.website_draft_revision dr ON dr.revision_id = ps.revision_id
  WHERE ps.token = p_token
    AND ps.expires_at > now()
    AND ps.revoked_at IS NULL
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = websites, public;

COMMIT;
