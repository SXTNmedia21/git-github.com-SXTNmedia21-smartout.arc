-- ============================================
-- 20260302000000_seed_landing_variants.sql
-- Seeds the 7 existing landing page variants with
-- content extracted from the hardcoded component files.
-- Each variant gets hero, features, voice_widget,
-- and cta_section blocks (plus variant-specific blocks).
-- Connected to: apps/landing/src/components/landing/
--               apps/landing/src/app/page.tsx
--               apps/landing/src/lib/variant-voice-config.ts
-- ============================================

DO $$
DECLARE
  v_id uuid;
  b_order int;
BEGIN

  -- ══════════════════════════════════════════════
  -- VARIANT B — Standard (Ingrid) — DEFAULT
  -- Persona: Daglig leder, orange accent
  -- Source: apps/landing/src/app/page.tsx
  -- ══════════════════════════════════════════════

  INSERT INTO public.landing_variant (slug, name, status, is_default, theme, meta_title, meta_description, voice_config, sort_order)
  VALUES (
    'default',
    'Standard (Ingrid)',
    'published',
    true,
    '{"accent": "orange", "accentColor": "234 88% 55%", "accentForeground": "0 0% 100%"}'::jsonb,
    'SmartOut — Én plattform. Full kontroll.',
    'AI-drevet workforce management for den norske serveringsbransjen. Samle vaktplaner, HR, kommunikasjon og internkontroll i ett system.',
    '{"personaName": "Ingrid", "personaRole": "Daglig leder", "accentColor": "orange", "placeholderTitle": "Lise venter...", "placeholderSubtitle": "Klikk her for å vekke røstassistenten og still spørsmål om vaktplan, onboarding eller rutiner.", "usePulse": true, "promptContext": "Du snakker med en besøkende som sannsynligvis er daglig leder for en restaurant eller hotell. Fokuser på den totale oversikten — tidsbesparelse, ansattfornøydhet og compliance."}'::jsonb,
    0
  ) RETURNING id INTO v_id;

  b_order := 0;

  -- Hero block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'hero', b_order,
    '{"heading": "Én plattform. Full kontroll.", "subheading": "Samle vaktplaner, HR, kommunikasjon, stemplingsur og internkontroll i ett og samme lynraske system. Reduser kaos og øk fortjenesten.", "buttons": [{"label": "Opprett din SmartOut", "href": "/onboarding", "style": "primary"}, {"label": "Møt AI-assistenten Lise", "href": "#smartout-ai", "style": "outline"}], "alignment": "center"}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Stats block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'stats', b_order,
    '{"heading": "Den operative ryggraden for moderne team", "items": [{"value": "2.5M+", "label": "Planlagte Vakter"}, {"value": "40%", "label": "Mindre Administrasjon"}, {"value": "0", "label": "Lovbrudd / Bøter"}, {"value": "99.9%", "label": "Plattform Oppetid"}]}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Features grid block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'features_grid', b_order,
    '{"heading": "Alt du trenger for å skalere.", "items": [{"icon": "Clock", "title": "Smart Vaktplanlegging", "description": "La AI bygge den optimale planen basert på historisk data og prognoser."}, {"icon": "TrendingUp", "title": "Live Lønnsprognoser", "description": "Se nøyaktig hva dagen koster før den starter. Ingen overraskelser ved månedsslutt."}, {"icon": "Shield", "title": "Automatisk Compliance", "description": "Få varsler før overtidsbrudd eller brudd på hviletid skjer."}, {"icon": "Building", "title": "Arbeidsgiver Hub", "description": "Sentraliserte kontrakter, dokumenter og kommunikasjon med hele teamet."}], "columns": 4}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Voice widget block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'voice_widget', b_order,
    '{"heading": "Møt SmartOut AI", "subheading": "Kunstig intelligens som faktisk forstår servicebransjen."}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- CTA section block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'cta_section', b_order,
    '{"heading": "Klar for fremtiden?", "subheading": "", "buttons": [{"label": "Kom i gang", "href": "/onboarding", "style": "primary"}], "background": "gradient"}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;


  -- ══════════════════════════════════════════════
  -- VARIANT E — Action (Lars Erik)
  -- Persona: Kjøkkensjef, orange-action accent
  -- Source: apps/landing/src/components/landing/VariantELanding.tsx
  -- ══════════════════════════════════════════════

  INSERT INTO public.landing_variant (slug, name, status, is_default, theme, meta_title, meta_description, voice_config, sort_order)
  VALUES (
    'action',
    'Action (Lars Erik)',
    'published',
    false,
    '{"accent": "orange-action", "accentColor": "234 88% 55%", "accentForeground": "0 0% 100%"}'::jsonb,
    'SmartOut — Intelligent Vaktplanlegging',
    'Slutt å drive butikken i skjøre regneark. Smartout orkestrerer hele driften din i én intelligent plattform.',
    '{"personaName": "Lars Erik", "personaRole": "Kjøkkensjef", "accentColor": "orange-action", "placeholderTitle": "Spør Lise.", "placeholderSubtitle": "Rett på sak — få svar om vaktplan, opplæring og rutiner.", "usePulse": true, "promptContext": "Du snakker med en erfaren kjøkkensjef. Fokuser på effektivitet, tidsbesparelse og kjøkkendrift. Vær direkte og konkret — denne personen har det travelt."}'::jsonb,
    1
  ) RETURNING id INTO v_id;

  b_order := 0;

  -- Hero block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'hero', b_order,
    '{"heading": "Intelligent Vaktplanlegging.", "subheading": "Slutt å drive butikken i skjøre regneark. Smartout orkestrerer hele driften din – fra kontrakter til live lønnsprognoser – i én intelligent plattform.", "buttons": [{"label": "Kom I Gang Nå", "href": "/onboarding", "style": "primary"}, {"label": "Se Interaktiv Demo", "href": "#features", "style": "outline"}], "alignment": "left"}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Features grid block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'features_grid', b_order,
    '{"heading": "Alt du trenger for å skalere.", "items": [{"icon": "Clock", "title": "Smart Vaktplanlegging", "description": "La AI bygge den optimale planen basert på historisk data og prognoser."}, {"icon": "TrendingUp", "title": "Live Lønnsprognoser", "description": "Se nøyaktig hva dagen koster før den starter. Ingen overraskelser ved månedsslutt."}, {"icon": "Shield", "title": "Automatisk Compliance", "description": "Få varsler før overtidsbrudd eller brudd på hviletid skjer."}, {"icon": "Building", "title": "Arbeidsgiver Hub", "description": "Sentraliserte kontrakter, dokumenter og kommunikasjon med hele teamet."}], "columns": 4}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Voice widget block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'voice_widget', b_order,
    '{"heading": "AI som leverer.", "subheading": "Raske svar. Automatisert drift. Null venting."}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- CTA section block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'cta_section', b_order,
    '{"heading": "Klar til å transformere driften?", "subheading": "Bli med tusenvis av bedrifter som bruker Smartout for å bygge robuste, effektive og lykkelige arbeidsplasser.", "buttons": [{"label": "Start Gratis Prøveperiode", "href": "/onboarding", "style": "primary"}, {"label": "Kontakt Salg", "href": "/pricing", "style": "outline"}], "background": "gradient"}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;


  -- ══════════════════════════════════════════════
  -- VARIANT T — Enterprise (Thomas)
  -- Persona: Senior HR-direktør, slate accent
  -- Source: apps/landing/src/components/landing/VariantTLanding.tsx
  -- ══════════════════════════════════════════════

  INSERT INTO public.landing_variant (slug, name, status, is_default, theme, meta_title, meta_description, voice_config, sort_order)
  VALUES (
    'enterprise',
    'Enterprise (Thomas)',
    'published',
    false,
    '{"accent": "slate", "accentColor": "215 16% 47%", "accentForeground": "0 0% 100%"}'::jsonb,
    'SmartOut — Full kontroll. Null gjetning.',
    'Samle sertifiseringer, opplæring og compliance i ett system. Revisjonsklar dokumentasjon, sanntidsdata og full integrasjonsstøtte.',
    '{"personaName": "Thomas", "personaRole": "Senior HR-direktør", "accentColor": "slate", "placeholderTitle": "Spør AI-assistenten.", "placeholderSubtitle": "Få svar om compliance, integrasjoner og revisjonsspor.", "usePulse": true, "promptContext": "Du snakker med en senior HR-direktør med 30+ års erfaring med ERP-systemer. Fokuser på data, compliance, integrasjoner og revisjonsspor. Bruk konkrete tall og fakta."}'::jsonb,
    2
  ) RETURNING id INTO v_id;

  b_order := 0;

  -- Hero block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'hero', b_order,
    '{"heading": "Full kontroll. Null gjetning.", "subheading": "Samle sertifiseringer, opplæring og compliance i ett system. Revisjonsklar dokumentasjon, sanntidsdata og full integrasjonsstøtte.", "buttons": [{"label": "Se plattformen", "href": "/onboarding", "style": "primary"}, {"label": "Book demo", "href": "#compliance", "style": "outline"}], "alignment": "left"}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Stats block (compliance counters)
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'stats', b_order,
    '{"heading": "Compliance i sanntid", "items": [{"value": "98.3%", "label": "compliance"}, {"value": "47", "label": "min spart daglig"}, {"value": "0", "label": "avvik siste 30 dager"}]}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Features grid block (integrations)
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'features_icons', b_order,
    '{"heading": "Kobles til systemene du allerede bruker", "items": [{"icon": "Server", "label": "Planday"}, {"icon": "Server", "label": "Quinyx"}, {"icon": "Server", "label": "Visma Lønn"}, {"icon": "Server", "label": "Tripletex"}, {"icon": "Server", "label": "HotSoft"}, {"icon": "Server", "label": "Infrasys"}, {"icon": "Server", "label": "Mews"}, {"icon": "Server", "label": "Lightspeed"}]}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Voice widget block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'voice_widget', b_order,
    '{"heading": "AI-drevet compliance", "subheading": "Revisjonsklar dokumentasjon generert automatisk."}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- CTA section block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'cta_section', b_order,
    '{"heading": "Klar for en strukturert overgang?", "subheading": "Se hvordan Smartout gir deg full kontroll over compliance, opplæring og revisjonsspor — på tvers av alle lokasjoner.", "buttons": [{"label": "Book en teknisk demo", "href": "/onboarding", "style": "primary"}], "background": "dark"}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;


  -- ══════════════════════════════════════════════
  -- VARIANT K — Konsulent (Katrine)
  -- Persona: Bransjerådgiver, emerald accent
  -- Source: apps/landing/src/components/landing/VariantKLanding.tsx
  -- ══════════════════════════════════════════════

  INSERT INTO public.landing_variant (slug, name, status, is_default, theme, meta_title, meta_description, voice_config, sort_order)
  VALUES (
    'consultant',
    'Konsulent (Katrine)',
    'published',
    false,
    '{"accent": "emerald", "accentColor": "160 84% 39%", "accentForeground": "0 0% 100%"}'::jsonb,
    'SmartOut — Vi leverer resultater. Ikke løfter.',
    'Dokumentert effekt hos 30+ norske hospitality-bedrifter. 67% reduksjon i opplæringstid. ROI innen tre måneder.',
    '{"personaName": "Katrine", "personaRole": "Bransjerådgiver", "accentColor": "emerald", "placeholderTitle": "Spør om bevisene.", "placeholderSubtitle": "Dokumenterte resultater, ROI og casestudier.", "usePulse": true, "promptContext": "Du snakker med en erfaren hospitality-konsulent som evaluerer verktøy for sine klienter. Fokuser på dokumentert ROI, målbare resultater og casestudier fra norske bedrifter."}'::jsonb,
    3
  ) RETURNING id INTO v_id;

  b_order := 0;

  -- Hero block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'hero', b_order,
    '{"heading": "Vi leverer resultater. Ikke løfter.", "subheading": "67% reduksjon i opplæringstid hos norske hospitality-bedrifter", "buttons": [{"label": "Se bevisene", "href": "/onboarding", "style": "primary"}, {"label": "Last ned ROI-kalkulator", "href": "#", "style": "outline"}], "alignment": "left"}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Case study block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'case_study', b_order,
    '{"heading": "Dokumenterte resultater.", "company": "Fjordhotellet, Bergen", "quote": "SmartOut halverte onboarding-tiden vår. Nye ansatte er produktive fra dag én.", "author_name": "Marte Solberg", "author_role": "HR-sjef", "metrics": [{"value": "67%", "label": "Raskere opplæring"}, {"value": "94%", "label": "Compliance-score"}, {"value": "3 mnd", "label": "Tilbakebetalingstid"}]}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Features grid block (regulatory cards)
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'features_grid', b_order,
    '{"heading": "Bygget for norske regler.", "items": [{"icon": "Scale", "title": "Arbeidsmiljøloven", "description": "Automatisk sporing av obligatorisk opplæring og HMS-krav."}, {"icon": "ShieldCheck", "title": "Mattilsynet HACCP", "description": "Digitale HACCP-sjekklister med automatisk loggføring."}, {"icon": "Wine", "title": "Alkoholloven", "description": "Sertifiseringssporing for skjenkebevilling og alderskontroll."}], "columns": 3}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Voice widget block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'voice_widget', b_order,
    '{"heading": "Dokumentert AI-effekt", "subheading": "Målbare forbedringer fra dag én."}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- CTA section block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'cta_section', b_order,
    '{"heading": "Ta en strategisk avgjørelse basert på data.", "subheading": "30 minutter. Ingen forpliktelse. Vi viser deg tallene som er relevante for din klients bransje og størrelse.", "buttons": [{"label": "Book en konsulent-briefing", "href": "/onboarding", "style": "primary"}], "background": "gradient"}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;


  -- ══════════════════════════════════════════════
  -- VARIANT A — Inkluderende (Ahmad)
  -- Persona: Hotellsjef, amber accent
  -- Source: apps/landing/src/components/landing/VariantALanding.tsx
  -- ══════════════════════════════════════════════

  INSERT INTO public.landing_variant (slug, name, status, is_default, theme, meta_title, meta_description, voice_config, sort_order)
  VALUES (
    'inclusive',
    'Inkluderende (Ahmad)',
    'published',
    false,
    '{"accent": "amber", "accentColor": "38 92% 50%", "accentForeground": "0 0% 100%"}'::jsonb,
    'SmartOut — Jobb med trygghet.',
    'SmartOut gjør deg klar for jobben — på ditt språk. Opplæring med bilder, video og 15+ språk.',
    '{"personaName": "Ahmad", "personaRole": "Hotellsjef", "accentColor": "amber", "placeholderTitle": "Snakk med Lise.", "placeholderSubtitle": "Spør om opplæring, språkstøtte og karrierevei.", "usePulse": true, "promptContext": "Du snakker med noen som verdsetter inkludering og flerspråklig støtte. Snakk tydelig og enkelt. Fokuser på visuell opplæring, språkstøtte og karrieremuligheter."}'::jsonb,
    4
  ) RETURNING id INTO v_id;

  b_order := 0;

  -- Hero block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'hero', b_order,
    '{"heading": "Jobb med trygghet.", "subheading": "SmartOut gjør deg klar for jobben — på ditt språk.", "buttons": [{"label": "Kom i gang", "href": "/onboarding", "style": "primary"}, {"label": "Se video", "href": "#", "style": "outline"}], "alignment": "center"}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Features grid block (how it works)
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'features_grid', b_order,
    '{"heading": "Enkelt. I tre steg.", "items": [{"icon": "BookOpen", "title": "Lær i ditt tempo", "description": "Opplæring med bilder, video og ditt språk."}, {"icon": "CheckCircle", "title": "Vis at du kan", "description": "Fullfør oppgaver og bli godkjent."}, {"icon": "TrendingUp", "title": "Voks i jobben", "description": "Bygg kompetanse og få nye muligheter."}], "columns": 3}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Testimonial block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'testimonial', b_order,
    '{"quote": "Jeg var redd for å starte med nytt datasystem. Men SmartOut var så enkelt at jeg klarte det på første forsøk — på polsk.", "name": "Maria K.", "role": "Servitør i 12 år", "company": ""}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Voice widget block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'voice_widget', b_order,
    '{"heading": "AI som forstår deg", "subheading": "Opplæring på ditt språk, i ditt tempo."}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- CTA section block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'cta_section', b_order,
    '{"heading": "Start gratis i dag.", "subheading": "", "buttons": [{"label": "Start gratis i dag.", "href": "/onboarding", "style": "primary"}], "background": "accent"}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;


  -- ══════════════════════════════════════════════
  -- VARIANT F — Tilgjengelig (Fatima)
  -- Persona: Renholdsarbeider, yellow accent
  -- Source: apps/landing/src/components/landing/VariantFLanding.tsx
  -- ══════════════════════════════════════════════

  INSERT INTO public.landing_variant (slug, name, status, is_default, theme, meta_title, meta_description, voice_config, sort_order)
  VALUES (
    'accessibility',
    'Tilgjengelig (Fatima)',
    'published',
    false,
    '{"accent": "yellow", "accentColor": "50 98% 64%", "accentForeground": "0 0% 9%"}'::jsonb,
    'SmartOut — Du klarer dette.',
    'SmartOut hjelper deg å lære jobben. Ingen lesing nødvendig. Lær med bilder og video.',
    '{"personaName": "Fatima", "personaRole": "Renholdsarbeider", "accentColor": "yellow", "placeholderTitle": "Trykk for å snakke.", "placeholderSubtitle": "", "usePulse": false, "promptContext": "Du snakker med noen som kanskje har begrenset leseevne. Snakk svært enkelt, kort og tydelig. Bruk korte setninger. Maksimalt 1–2 setninger per svar."}'::jsonb,
    5
  ) RETURNING id INTO v_id;

  b_order := 0;

  -- Hero block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'hero', b_order,
    '{"heading": "Du klarer dette.", "subheading": "SmartOut hjelper deg å lære jobben.", "buttons": [{"label": "Kom i gang", "href": "/onboarding", "style": "primary"}], "alignment": "center"}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Features icons block (giant icons, minimal text)
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'features_icons', b_order,
    '{"heading": "SmartOut hjelper deg:", "items": [{"icon": "PlayCircle", "label": "Lær med video"}, {"icon": "Image", "label": "Se bilder"}, {"icon": "CheckCircle", "label": "Fullfør oppgaver"}, {"icon": "Globe", "label": "Ditt eget språk"}]}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Voice widget block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'voice_widget', b_order,
    '{"heading": "AI hjelper deg", "subheading": ""}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- CTA section block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'cta_section', b_order,
    '{"heading": "Prøv det nå.", "subheading": "", "buttons": [{"label": "Start nå", "href": "/onboarding", "style": "primary"}], "background": "accent"}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;


  -- ══════════════════════════════════════════════
  -- VARIANT S — Eleganse (Signe)
  -- Persona: Sommelier, rose accent
  -- Source: apps/landing/src/components/landing/VariantSLanding.tsx
  -- ══════════════════════════════════════════════

  INSERT INTO public.landing_variant (slug, name, status, is_default, theme, meta_title, meta_description, voice_config, sort_order)
  VALUES (
    'elegance',
    'Eleganse (Signe)',
    'published',
    false,
    '{"accent": "rose", "accentColor": "347 77% 50%", "accentForeground": "0 0% 100%"}'::jsonb,
    'SmartOut — Håndverk møter teknologi.',
    'SmartOut gjør dine ansatte klare fra dag én — med presisjon, respekt og teknologi i balanse.',
    '{"personaName": "Signe", "personaRole": "Sommelier", "accentColor": "rose", "placeholderTitle": "En samtale om kvalitet.", "placeholderSubtitle": "Utforsk hvordan teknologi løfter håndverket.", "usePulse": false, "promptContext": "Du snakker med en erfaren sommelier og kvalitetsekspert. Vær raffinert og presis. Fokuser på håndverk, presisjon, kvalitetsstandarder og balansen mellom tradisjon og teknologi."}'::jsonb,
    6
  ) RETURNING id INTO v_id;

  b_order := 0;

  -- Hero block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'hero', b_order,
    '{"heading": "Håndverk møter teknologi.", "subheading": "SmartOut gjør dine ansatte klare fra dag én — med presisjon, respekt og teknologi i balanse.", "buttons": [{"label": "Utforsk SmartOut", "href": "/onboarding", "style": "outline"}], "alignment": "center"}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Features grid block (training features)
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'features_grid', b_order,
    '{"heading": "Opplæring skreddersydd til ditt håndverk.", "items": [{"icon": "Wine", "title": "Skreddersydde opplæringsprogrammer", "description": "Tilpasset din bedrifts unike behov, tradisjoner og kvalitetsstandarder."}, {"icon": "BookOpen", "title": "Bransjespesifikt innhold", "description": "Faglig innhold utviklet i samarbeid med bransjens fremste eksperter."}, {"icon": "Award", "title": "Praktisk kompetansebygging", "description": "Fra teori til mestring — hands-on læring som sitter."}], "columns": 3}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Features list block (detail cards)
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'features_list', b_order,
    '{"heading": "Detaljer som gjør forskjellen.", "items": [{"icon": "GlassWater", "title": "Sensorisk evaluering", "description": "Strukturert opplæring i smak, aroma og presentasjon — fra grunnleggende til avansert nivå."}, {"icon": "Wine", "title": "Vinprogrammer", "description": "Skreddersydde programmer for vinkart, anbefaling og salg tilpasset din meny."}, {"icon": "Utensils", "title": "Servicestandarder", "description": "Definer og vedlikehold servicenivået som gjestene dine fortjener — hver eneste dag."}]}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- Voice widget block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'voice_widget', b_order,
    '{"heading": "Intelligens med balanse", "subheading": "Teknologi som respekterer håndverket."}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

  -- CTA section block
  INSERT INTO public.landing_block (variant_id, block_type, sort_order, content, settings)
  VALUES (v_id, 'cta_section', b_order,
    '{"heading": "Er du klar til å sette en ny standard?", "subheading": "", "buttons": [{"label": "Kom i gang", "href": "/onboarding", "style": "outline"}], "background": "dark"}'::jsonb,
    '{}'::jsonb);
  b_order := b_order + 1;

END $$;
