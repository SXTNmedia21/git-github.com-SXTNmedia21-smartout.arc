SET search_path TO public, extensions;

-- Rename is_super_admin → is_godmode on user_identity
-- Godmode = full platform control, overrules all workspace roles
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_identity' AND column_name = 'is_super_admin') THEN
    ALTER TABLE public.user_identity RENAME COLUMN is_super_admin TO is_godmode;
  END IF;
END $$;

-- Recreate RLS policies on platform_api_key tables that reference the column
-- (ALTER RENAME propagates through catalog, but we recreate for clarity in migration history)

-- platform_api_key
DROP POLICY IF EXISTS super_admin_all ON public.platform_api_key;
CREATE POLICY super_admin_all ON public.platform_api_key FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_identity WHERE user_id = auth.uid() AND is_godmode = true));

-- platform_api_key_usage
DROP POLICY IF EXISTS super_admin_all ON public.platform_api_key_usage;
CREATE POLICY super_admin_all ON public.platform_api_key_usage FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_identity WHERE user_id = auth.uid() AND is_godmode = true));

-- platform_external_secret
DROP POLICY IF EXISTS super_admin_all ON public.platform_external_secret;
CREATE POLICY super_admin_all ON public.platform_external_secret FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_identity WHERE user_id = auth.uid() AND is_godmode = true));
