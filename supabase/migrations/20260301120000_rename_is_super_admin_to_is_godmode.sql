-- Rename is_super_admin → is_godmode on user_identity
-- Godmode = full platform control, overrules all workspace roles
ALTER TABLE public.user_identity RENAME COLUMN is_super_admin TO is_godmode;

-- Recreate RLS policies on platform_api_key tables that reference the column
-- (ALTER RENAME propagates through catalog, but we recreate for clarity in migration history)

-- platform_api_key
DROP POLICY IF EXISTS super_admin_all ON public.platform_api_key;
CREATE POLICY super_admin_all ON public.platform_api_key FOR ALL
USING (EXISTS (SELECT 1 FROM user_identity WHERE user_id = auth.uid() AND is_godmode = true));

-- platform_api_key_usage
DROP POLICY IF EXISTS super_admin_all ON public.platform_api_key_usage;
CREATE POLICY super_admin_all ON public.platform_api_key_usage FOR ALL
USING (EXISTS (SELECT 1 FROM user_identity WHERE user_id = auth.uid() AND is_godmode = true));

-- platform_external_secret
DROP POLICY IF EXISTS super_admin_all ON public.platform_external_secret;
CREATE POLICY super_admin_all ON public.platform_external_secret FOR ALL
USING (EXISTS (SELECT 1 FROM user_identity WHERE user_id = auth.uid() AND is_godmode = true));
