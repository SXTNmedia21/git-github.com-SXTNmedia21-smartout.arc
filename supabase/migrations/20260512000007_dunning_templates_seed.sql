SET search_path TO public, extensions;

-- ============================================
-- 20260512000007_dunning_templates_seed.sql
-- Billing Engine Fase 3A — B1 Migration H
--
-- Seeds three platform-owned dispatch templates for automatic dunning
-- emails. Rendered by the email_customer dispatch adapter when the
-- scan_overdue_invoices handler (B4) enqueues invoice_dispatch rows.
--
-- Template tone ladder (spec §4.3):
--   reminder_1          — vennlig, kort påminnelse
--   reminder_2          — formell, nevner forsinkelsesrente
--   collection_notice   — alvorlig, siste frist før inkasso
--
-- Mustache-style placeholders resolved at dispatch time:
--   {{invoice.number}}           invoice.invoice_number
--   {{company.name}}             workspace/company.name
--   {{invoice.amount_incl_vat}}  formatted amount + currency
--   {{invoice.due_at}}           ISO date, formatted to nb-NO
--   {{days_overdue}}             int, computed at render
--
-- Copy is v1 — spec §4.3 flags tone-critical copy for designer/legal
-- review in Fase 3B. These templates ship as "reasonable Norwegian
-- defaults" to unblock B4 + B5 testing. DO NOT treat as final production
-- copy without Fase 3B sign-off.
--
-- English versions ship in Fase 3B (spec §15 forward-compat).
--
-- Ref: Fase 3A spec §4.3.
-- ============================================

-- Delete + re-insert is simpler than ON CONFLICT here since name is not
-- UNIQUE. Idempotent via WHERE name clause on DELETE.
DELETE FROM public.billing_dispatch_template
WHERE workspace_id IS NULL
  AND name IN ('dunning_reminder_1', 'dunning_reminder_2', 'dunning_collection_notice');

-- ── reminder_1 — vennlig påminnelse (3 dager forfalt) ────────
INSERT INTO public.billing_dispatch_template
  (workspace_id, name, channel, subject_template, body_template, locale)
VALUES (
  NULL,
  'dunning_reminder_1',
  'email_customer',
  'Påminnelse: Faktura {{invoice.number}}',
  $body$Hei {{company.name}},

Dette er en vennlig påminnelse om at faktura {{invoice.number}} forfalt til betaling {{invoice.due_at}}.

Utestående beløp: {{invoice.amount_incl_vat}}

Om du allerede har betalt kan du se bort fra denne meldingen. Ellers ber vi deg gjennomføre betalingen ved første anledning.

Har du spørsmål, svar på denne e-posten.

Vennlig hilsen
Smartout$body$,
  'nb-NO'
);

-- ── reminder_2 — formell (7 dager forfalt) ──────────────────
INSERT INTO public.billing_dispatch_template
  (workspace_id, name, channel, subject_template, body_template, locale)
VALUES (
  NULL,
  'dunning_reminder_2',
  'email_customer',
  'Forfalt: Faktura {{invoice.number}}',
  $body$Hei {{company.name}},

Vi registrerer at faktura {{invoice.number}} nå er {{days_overdue}} dager forfalt.

Utestående beløp: {{invoice.amount_incl_vat}}
Forfallsdato: {{invoice.due_at}}

Vi ber deg gjennomføre betalingen umiddelbart. Forsinkelsesrente kan påløpe i henhold til forsinkelsesrenteloven.

Om du har spørsmål eller fakturaen er bestridt, ta kontakt med oss snarest ved å svare på denne e-posten.

Med vennlig hilsen
Smartout$body$,
  'nb-NO'
);

-- ── collection_notice — alvorlig (14 dager forfalt) ─────────
INSERT INTO public.billing_dispatch_template
  (workspace_id, name, channel, subject_template, body_template, locale)
VALUES (
  NULL,
  'dunning_collection_notice',
  'email_customer',
  'Siste purring før inkasso — Faktura {{invoice.number}}',
  $body$Hei {{company.name}},

Faktura {{invoice.number}} er nå {{days_overdue}} dager forfalt og har blitt sendt to påminnelser uten betaling eller tilbakemelding.

Utestående beløp: {{invoice.amount_incl_vat}}
Forfallsdato: {{invoice.due_at}}

Dette er siste varsel før saken overføres til inkasso. Dersom beløpet ikke er oss i hende innen 14 dager fra dagens dato, vil kravet bli oversendt til inkassobyrå — noe som medfører vesentlige tilleggskostnader for deg.

Vennligst gjennomfør betaling umiddelbart. Ta kontakt ved å svare på denne e-posten dersom det foreligger forhold som gjør at kravet er bestridt.

Med hilsen
Smartout$body$,
  'nb-NO'
);

-- ── Post-seed audit ─────────────────────────────────────────
-- DEV-NOTE: templates above are "v1 — designer review in Fase 3B" per
-- spec §4.3. The reminder_1 tone is deliberately light; reminder_2
-- invokes forsinkelsesrenteloven; collection_notice signals inkasso
-- handover. Legal review pending in Fase 3B.
