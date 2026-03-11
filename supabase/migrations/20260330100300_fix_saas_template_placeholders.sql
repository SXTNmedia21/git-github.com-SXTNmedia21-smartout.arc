SET search_path TO public, extensions;

-- Fix: Update placeholders array to match actual keys used in content_html (from 20260330100200)
-- The previous placeholders array had old keys (name_company, company_street, etc.)
-- but the HTML uses data-key attributes with new keys (kunde_firma, kunde_adresse, etc.)

UPDATE contract_template
SET placeholders = '[
  {"key": "kunde_firma",           "label": "Kundefirma",              "source": "workspace.company", "required": true},
  {"key": "kunde_adresse",         "label": "Kundeadresse",            "source": "workspace",         "required": true},
  {"key": "kunde_postnr_sted",     "label": "Postnr./sted",            "source": "workspace",         "required": true},
  {"key": "kunde_org_nr",          "label": "Org.nr. kunde",           "source": "workspace.company", "required": true},
  {"key": "kunde_tlf",             "label": "Telefon kunde",           "source": "workspace.company", "required": false},
  {"key": "kunde_epost",           "label": "E-post kunde",            "source": "workspace.company", "required": true},
  {"key": "kunde_faktura_epost",   "label": "Faktura e-post",          "source": "workspace.company", "required": false},
  {"key": "kunde_daglig_leder",    "label": "Daglig leder",            "source": "manual",            "required": true},
  {"key": "kunde_tittel",          "label": "Tittel kunde",            "source": "manual",            "required": false, "default_value": "Daglig leder"},
  {"key": "abonnement_type",       "label": "Abonnementstype",         "source": "manual",            "required": true,  "default_value": "Basic"},
  {"key": "arspris",               "label": "Arspris (eks. mva)",      "source": "manual",            "required": true,  "default_value": "995"},
  {"key": "inkl_brukere",          "label": "Inkluderte brukere",      "source": "manual",            "required": true,  "default_value": "10"},
  {"key": "tilleggsbruker_pris",   "label": "Pris tilleggsbruker",     "source": "manual",            "required": true,  "default_value": "50"},
  {"key": "betalingsbetingelser",  "label": "Betalingsbetingelser",    "source": "manual",            "required": true,  "default_value": "10"},
  {"key": "oppsigelsestid",        "label": "Oppsigelsestid",          "source": "manual",            "required": true,  "default_value": "Innev. + 3 mnd."},
  {"key": "oppstartshjelp",        "label": "Oppstartshjelp",          "source": "manual",            "required": false, "default_value": "Oppstartshjelp: 3 timer digital gjennomgang og oppsett av systemet, inkludert import av ansatte, vaktlister, tillegg og regler."},
  {"key": "smartout_kontakt",      "label": "Kontaktperson Smartout",  "source": "constant",          "required": false, "default_value": "Pontus S. Lindroth"},
  {"key": "smartout_tittel",       "label": "Tittel Smartout",         "source": "constant",          "required": false, "default_value": "CEO"}
]'::jsonb,
    updated_at = now()
WHERE template_id = 'c0000002-0000-0000-0000-000000000002';
