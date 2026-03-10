SET search_path TO public, extensions;

-- Migration: workspace KPI copy
-- Stores KPI explanation copy per workspace and locale for dashboard strategic cards.
-- Follows workspace-scoped RLS pattern: JWT read/write + API key read.

CREATE TABLE IF NOT EXISTS public.workspace_kpi_copy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (
    metric IN (
      'cost_of_sales',
      'turnover_90d',
      'absence_rate',
      'time_to_job_ready',
      'task_completion',
      'training_readiness'
    )
  ),
  locale TEXT NOT NULL DEFAULT 'nb' CHECK (char_length(locale) >= 2 AND char_length(locale) <= 10),
  explanation TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, metric, locale)
);

ALTER TABLE public.workspace_kpi_copy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_workspace_kpi_copy" ON public.workspace_kpi_copy;
CREATE POLICY "jwt_read_workspace_kpi_copy" ON public.workspace_kpi_copy
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_write_workspace_kpi_copy" ON public.workspace_kpi_copy;
CREATE POLICY "jwt_write_workspace_kpi_copy" ON public.workspace_kpi_copy
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_workspace_kpi_copy" ON public.workspace_kpi_copy;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'get_api_workspace_id'
      AND pg_function_is_visible(oid)
  ) THEN
    CREATE POLICY "api_key_read_workspace_kpi_copy" ON public.workspace_kpi_copy
      FOR SELECT USING (workspace_id = get_api_workspace_id());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workspace_kpi_copy_workspace_id
  ON public.workspace_kpi_copy(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_kpi_copy_workspace_metric_locale
  ON public.workspace_kpi_copy(workspace_id, metric, locale);

DROP TRIGGER IF EXISTS set_workspace_kpi_copy_updated_at ON public.workspace_kpi_copy;
CREATE TRIGGER set_workspace_kpi_copy_updated_at
  BEFORE UPDATE ON public.workspace_kpi_copy
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed baseline NB copy for all existing workspaces.
INSERT INTO public.workspace_kpi_copy (workspace_id, metric, locale, explanation, source)
SELECT
  w.workspace_id,
  v.metric,
  'nb',
  v.explanation,
  'seed:20260411120000_workspace_kpi_copy'
FROM public.workspace w
CROSS JOIN (
  VALUES
    ('cost_of_sales', 'Beregnes ved å dele totale lønnskostnader på total omsetning i valgt periode (rullerende 30 dager). Juster målet for å utløse tidligere varsler.'),
    ('turnover_90d', 'Beregnes ved å dele antall ansatte som har sluttet på gjennomsnittlig antall ansatte over 90 dager. Måles mot ditt satte mål.'),
    ('absence_rate', 'Totale registrerte fraværstimer delt på totale forventede arbeidstimer hittil denne måneden. Brukes til å oppdage tidlige tegn på teamutmattelse.'),
    ('time_to_job_ready', 'Gjennomsnittlig antall dager mellom en ansatts første vakt og fullføring av alle påkrevde onboarding-løp inkludert samsvarskontroller.'),
    ('task_completion', 'Andel tildelte arbeidsoppgaver (åpning, stenging, vedlikehold) fullført på tvers av alle vakter som matcher lokasjonsfilter.'),
    ('training_readiness', 'Andel protokolltildelinger fullført av aktive ansatte. Måler den totale bemanningsberedskapen.')
) AS v(metric, explanation)
ON CONFLICT (workspace_id, metric, locale) DO NOTHING;
