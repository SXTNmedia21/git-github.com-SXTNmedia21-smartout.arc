SET search_path TO public, extensions;

-- Fix engine_memory CHECK constraints that are too restrictive.
-- The original migration only allowed ('preference', 'fact', 'summary') for memory_type
-- and ('personal', 'team', 'workspace') for scope, but the application actually uses
-- broader values like 'general', 'constant', 'conversation', 'onboarding'.
--
-- Also adds a JWT write policy so that authenticated users can save their own memories
-- (previously only service_role could write — every Emma/agent memory save failed silently).

-- 1. Expand memory_type CHECK constraint
ALTER TABLE engine_memory DROP CONSTRAINT IF EXISTS engine_memory_memory_type_check;
ALTER TABLE engine_memory ADD CONSTRAINT engine_memory_memory_type_check
  CHECK (memory_type IN ('preference', 'fact', 'summary', 'general', 'constant'));

-- 2. Expand scope CHECK constraint
ALTER TABLE engine_memory DROP CONSTRAINT IF EXISTS engine_memory_scope_check;
ALTER TABLE engine_memory ADD CONSTRAINT engine_memory_scope_check
  CHECK (scope IN ('personal', 'team', 'workspace', 'conversation', 'onboarding'));

-- 3. Fix importance range — keep 0.0-1.0 but the code now sends valid values
-- (No change needed to DB constraint — the code will be fixed to send 0.5 instead of 5)

-- 4. Add JWT write policy so authenticated users can insert/update their own memories
DROP POLICY IF EXISTS "jwt_write_own_memory" ON engine_memory;
CREATE POLICY "jwt_write_own_memory" ON engine_memory
FOR INSERT WITH CHECK (
  profile_id IN (
    SELECT p.profile_id FROM public.profile p
    WHERE p.user_id = auth.uid() AND p.is_active = true
  )
  AND workspace_id IN (
    SELECT p.workspace_id FROM public.profile p
    WHERE p.user_id = auth.uid() AND p.is_active = true
  )
);

-- 5. Add JWT update policy for own memories
DROP POLICY IF EXISTS "jwt_update_own_memory" ON engine_memory;
CREATE POLICY "jwt_update_own_memory" ON engine_memory
FOR UPDATE USING (
  profile_id IN (
    SELECT p.profile_id FROM public.profile p
    WHERE p.user_id = auth.uid() AND p.is_active = true
  )
);
