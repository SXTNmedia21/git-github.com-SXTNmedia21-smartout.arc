-- Template: Restaurant Policies
-- Industry:   restaurant (NACE 56.101)
-- Policies:   10 (4 haccp, 3 operational, 1 safety, 1 hr, 1 access)
-- References: Mattilsynet, Arbeidsmiljøloven, Alkoholloven, Forskrift om brannforebygging
-- Depends:    departments.sql (for department-scoped policies)
-- Usage:      SELECT template_restaurant_policies(p_workspace_id);
--
-- NOTE: This only creates policies. Protocols, procedures, routines etc.
--       are created by governance.sql which depends on these policies.

CREATE OR REPLACE FUNCTION template_restaurant_policies(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_profile uuid;
  v_season_id uuid;
  v_dept_kitchen uuid;
  v_dept_bar uuid;
BEGIN
  -- Look up admin/owner profile (admin preferred, owner as fallback)
  SELECT profile_id INTO v_admin_profile FROM public.profile
  WHERE workspace_id = p_workspace_id AND role IN ('admin', 'owner')
  ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'owner' THEN 1 END
  LIMIT 1;

  IF v_admin_profile IS NULL THEN
    RAISE EXCEPTION 'No admin or owner profile found for workspace %', p_workspace_id;
  END IF;

  -- Look up active season
  SELECT season_id INTO v_season_id FROM public.season
  WHERE workspace_id = p_workspace_id AND status = 'active' LIMIT 1;

  -- Look up departments for scoped policies
  SELECT department_id INTO v_dept_kitchen FROM public.department
  WHERE workspace_id = p_workspace_id AND slug = 'kjokken';

  SELECT department_id INTO v_dept_bar FROM public.department
  WHERE workspace_id = p_workspace_id AND slug = 'bar';

  -- ==========================================================================
  -- WORKSPACE-SCOPED POLICIES (everyone must follow)
  -- ==========================================================================

  INSERT INTO public.policy (
    workspace_id, season_id, policy_type, policy_scope, name, description,
    statement, enforcement_status, priority, created_by
  ) VALUES
  -- 1. Temperaturkontroll (HACCP)
  (
    p_workspace_id, v_season_id, 'haccp', 'workspace',
    'Temperaturkontroll',
    'Kontroll av kjøle- og fryseenheter iht. Mattilsynets krav til internkontroll.',
    'Alle kjøle- og fryseenheter skal kontrolleres minimum to ganger daglig. Avvik utenfor godkjent temperaturområde skal håndteres umiddelbart iht. Mattilsynets retningslinjer. Kjøleskap: 0-4°C. Fryser: -18°C eller kaldere.',
    'enforced', 10, v_admin_profile
  ),
  -- 2. Allergenhåndtering (HACCP)
  (
    p_workspace_id, v_season_id, 'haccp', 'workspace',
    'Allergenhåndtering',
    'Merking og kommunikasjon av allergener iht. EU-forordning 1169/2011.',
    'Alle retter skal merkes med allergener iht. EU-forordning 1169/2011. Personalet skal kunne informere gjester om allergeninnhold i alle retter. De 14 hovedallergenene skal være dokumentert for hver rett på menyen.',
    'enforced', 9, v_admin_profile
  ),
  -- 3. Åpningsrutiner (Operasjonell)
  (
    p_workspace_id, v_season_id, 'operational', 'workspace',
    'Åpningsrutiner',
    'Standardisert oppstart av alle avdelinger før drift.',
    'Alle avdelinger skal gjennomføre fastsatt åpningsrutine før gjester mottas. Skiftleder bekrefter at sjekklisten er fullført. Ingen gjester slipper inn før åpningsrutinen er godkjent.',
    'enforced', 8, v_admin_profile
  ),
  -- 4. Stengerutiner (Operasjonell)
  (
    p_workspace_id, v_season_id, 'operational', 'workspace',
    'Stengerutiner',
    'Standardisert nedstengning etter drift.',
    'Alle avdelinger skal gjennomføre fastsatt stengerutine etter siste gjest. Kassaoppgjør, renhold og sikring skal dokumenteres. Skiftleder signerer.',
    'enforced', 8, v_admin_profile
  ),
  -- 5. Håndhygiene (HACCP)
  (
    p_workspace_id, v_season_id, 'haccp', 'workspace',
    'Håndhygiene',
    'Krav til håndvask iht. Forskrift om næringsmiddelhygiene.',
    'Alle ansatte i kjøkken og sal skal vaske hender ved oppstart, etter toalettbesøk, etter håndtering av rått kjøtt, og mellom arbeidsoppgaver. Håndvask skal utføres med antibakteriell såpe i minimum 20 sekunder.',
    'enforced', 9, v_admin_profile
  ),
  -- 6. Brannvern og evakuering (Sikkerhet)
  (
    p_workspace_id, v_season_id, 'safety', 'workspace',
    'Brannvern og evakuering',
    'Brannberedskap iht. Forskrift om brannforebygging §4.',
    'Alle ansatte skal kjenne rømningsveier, møteplass og plassering av slokkeutstyr. Brannøvelse gjennomføres minimum to ganger årlig. Nye ansatte skal ha brannvernopplæring innen første arbeidsuke.',
    'enforced', 10, v_admin_profile
  ),
  -- 7. Varemottak og lagring (HACCP)
  (
    p_workspace_id, v_season_id, 'haccp', 'workspace',
    'Varemottak og lagring',
    'Kontroll av vareleveranser og korrekt lagring.',
    'Alle vareleveranser skal kontrolleres ved mottak: temperatur, holdbarhetsdato, emballasje. FIFO-prinsippet gjelder i alle kjøle- og tørrlager. Varer med skadet emballasje eller avvikende temperatur avvises.',
    'enforced', 7, v_admin_profile
  ),
  -- 8. Arbeidsmiljø og HMS (HR)
  (
    p_workspace_id, v_season_id, 'hr', 'workspace',
    'Arbeidsmiljø og HMS',
    'Arbeidsmiljølovens krav til helse, miljø og sikkerhet.',
    'Arbeidsgiver skal sikre et fullt forsvarlig arbeidsmiljø iht. Arbeidsmiljøloven. Verneombud skal være oppnevnt. Avviksmeldinger behandles innen 48 timer. Alle skader og nestenulykker skal rapporteres.',
    'enforced', 6, v_admin_profile
  )
  ON CONFLICT DO NOTHING;

  -- ==========================================================================
  -- DEPARTMENT-SCOPED POLICIES
  -- ==========================================================================

  -- 9. Kassaoppgjør (scoped to Restaurant department, but applies broadly)
  INSERT INTO public.policy (
    workspace_id, season_id, policy_type, policy_scope, scope_ref_id, name, description,
    statement, enforcement_status, priority, created_by
  ) VALUES
  (
    p_workspace_id, v_season_id, 'operational', 'department', v_dept_kitchen,
    'Kassaoppgjør og verdihåndtering',
    'Rutiner for kasseoppgjør, kontanthåndtering og avstemming.',
    'Kasse skal telles og avstemmes ved hvert skiftbytte og ved stenging. Avvik over NOK 50 rapporteres til daglig leder. Kontanter plasseres i safe. Z-rapport skrives ut og arkiveres.',
    'enforced', 7, v_admin_profile
  ),
  -- 10. Skjenkekontroll (scoped to Bar department)
  (
    p_workspace_id, v_season_id, 'operational', 'department', v_dept_bar,
    'Skjenkekontroll og aldersgrense',
    'Alderskontroll og ansvarlig alkoholservering iht. Alkoholloven.',
    'Alle gjester som ser under 25 år ut skal legitimeres ved bestilling av alkohol. Skjenketider følger kommunale bestemmelser. Overstadig berusede personer nektes servering iht. Alkoholloven §8-11. Godkjent ID: pass, førerkort, bankkort med bilde.',
    'enforced', 9, v_admin_profile
  )
  ON CONFLICT DO NOTHING;

END;
$$;
