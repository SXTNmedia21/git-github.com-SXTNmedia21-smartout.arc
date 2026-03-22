ALTER TABLE public.workspace ADD COLUMN IF NOT EXISTS has_website boolean NOT NULL DEFAULT false;
