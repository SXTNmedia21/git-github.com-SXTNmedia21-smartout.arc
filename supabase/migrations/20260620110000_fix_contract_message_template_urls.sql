-- Fix contract message template URLs: smartout.io → smartout.ai
--
-- Original seed (20260228140100_seed_contract_message_templates.sql) hardcoded
-- smartout.io URLs. SendGrid Link Branding subdomain url9671.smartout.io
-- returns NXDOMAIN — only smartout.ai resolves. Forward-only UPDATE keeps
-- the original seed intact while correcting live rows.
--
-- See: feat/email-domain-fix sortie (PLAN-email-domain-fix.md), 2026-05-18.

SET search_path TO public, extensions;

UPDATE message_template
   SET cta_url_template = REPLACE(cta_url_template, 'https://smartout.io/', 'https://smartout.ai/')
 WHERE cta_url_template LIKE 'https://smartout.io/%';
