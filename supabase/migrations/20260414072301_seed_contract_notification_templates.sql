-- 20260414072301_seed_contract_notification_templates.sql
-- Seed message_template rows for contract lifecycle notifications.
--
-- Rewritten 2026-04-15 to match actual message_template schema
-- (key/subject_no/subject_en/body_no/body_en). Original used misaligned
-- column names (template_key/language/subject/body) that did not exist
-- on the table defined in 20260228140000_contract_system_foundation.sql,
-- causing `npx supabase db reset` to fail.

INSERT INTO public.message_template (
  key, channel, category,
  subject_no, subject_en,
  body_no, body_en
) VALUES
  ('contract.employee.created', 'email', 'contract',
   'Ny kontrakt opprettet',
   'New contract created',
   'Hei {{employee_name}}, en ny kontrakt er opprettet for deg hos {{company_name}}.',
   'Hi {{employee_name}}, a new contract has been created for you at {{company_name}}.'),

  ('contract.employee.sent', 'email', 'contract',
   'Kontrakt klar for signering',
   'Contract ready for signing',
   'Hei {{employee_name}}, du har en kontrakt som venter på din signering. Vennligst logg inn for å se og signere kontrakten.',
   'Hi {{employee_name}}, you have a contract waiting for your signature. Please log in to view and sign the contract.'),

  ('contract.employee.signed.admin', 'email', 'contract',
   'Kontrakt signert av {{employee_name}}',
   'Contract signed by {{employee_name}}',
   '{{employee_name}} har signert kontrakten sin. Du kan nå se den signerte kontrakten i dashbordet.',
   '{{employee_name}} has signed their contract. You can now view the signed contract in the dashboard.'),

  ('contract.employee.signed.employee', 'email', 'contract',
   'Kontrakten din er signert',
   'Your contract is signed',
   'Hei {{employee_name}}, kontrakten din er nå signert. Du kan finne en kopi i dashbordet ditt.',
   'Hi {{employee_name}}, your contract is now signed. You can find a copy in your dashboard.'),

  ('contract.employee.declined', 'email', 'contract',
   'Kontrakt avslått av {{employee_name}}',
   'Contract declined by {{employee_name}}',
   '{{employee_name}} har avslått kontrakten. Vennligst følg opp med den ansatte.',
   '{{employee_name}} has declined the contract. Please follow up with the employee.'),

  ('contract.employee.expired.admin', 'email', 'contract',
   'Kontrakt utløpt — {{employee_name}}',
   'Contract expired — {{employee_name}}',
   'Kontrakten for {{employee_name}} har utløpt uten signering. Vurder å sende en ny kontrakt.',
   'The contract for {{employee_name}} has expired without being signed. Consider sending a new contract.'),

  ('contract.employee.expired.employee', 'email', 'contract',
   'Kontrakten din har utløpt',
   'Your contract has expired',
   'Hei {{employee_name}}, kontrakten din har utløpt. Kontakt din leder for videre informasjon.',
   'Hi {{employee_name}}, your contract has expired. Contact your manager for further information.'),

  ('contract.employee.reminder', 'email', 'contract',
   'Påminnelse: Signer kontrakten din',
   'Reminder: Sign your contract',
   'Hei {{employee_name}}, du har fortsatt en usignert kontrakt. Vennligst logg inn og signer så snart som mulig.',
   'Hi {{employee_name}}, you still have an unsigned contract. Please log in and sign it as soon as possible.')

ON CONFLICT (key) DO NOTHING;
