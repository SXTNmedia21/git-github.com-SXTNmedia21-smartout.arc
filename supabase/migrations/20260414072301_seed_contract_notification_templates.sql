-- 20260414072301_seed_contract_notification_templates.sql
-- Seed message_template rows for contract lifecycle notifications.
-- Norwegian (no) and English (en) variants for each template.

INSERT INTO message_template (category, template_key, language, subject, body, channel, created_at)
VALUES
  -- contract.employee.created
  ('contract', 'contract.employee.created', 'no',
   'Ny kontrakt opprettet',
   'Hei {{employee_name}}, en ny kontrakt er opprettet for deg hos {{company_name}}.',
   'email', now()),
  ('contract', 'contract.employee.created', 'en',
   'New contract created',
   'Hi {{employee_name}}, a new contract has been created for you at {{company_name}}.',
   'email', now()),

  -- contract.employee.sent
  ('contract', 'contract.employee.sent', 'no',
   'Kontrakt klar for signering',
   'Hei {{employee_name}}, du har en kontrakt som venter på din signering. Vennligst logg inn for å se og signere kontrakten.',
   'email', now()),
  ('contract', 'contract.employee.sent', 'en',
   'Contract ready for signing',
   'Hi {{employee_name}}, you have a contract waiting for your signature. Please log in to view and sign the contract.',
   'email', now()),

  -- contract.employee.signed.admin
  ('contract', 'contract.employee.signed.admin', 'no',
   'Kontrakt signert av {{employee_name}}',
   '{{employee_name}} har signert kontrakten sin. Du kan nå se den signerte kontrakten i dashbordet.',
   'email', now()),
  ('contract', 'contract.employee.signed.admin', 'en',
   'Contract signed by {{employee_name}}',
   '{{employee_name}} has signed their contract. You can now view the signed contract in the dashboard.',
   'email', now()),

  -- contract.employee.signed.employee
  ('contract', 'contract.employee.signed.employee', 'no',
   'Kontrakten din er signert',
   'Hei {{employee_name}}, kontrakten din er nå signert. Du kan finne en kopi i dashbordet ditt.',
   'email', now()),
  ('contract', 'contract.employee.signed.employee', 'en',
   'Your contract is signed',
   'Hi {{employee_name}}, your contract is now signed. You can find a copy in your dashboard.',
   'email', now()),

  -- contract.employee.declined
  ('contract', 'contract.employee.declined', 'no',
   'Kontrakt avslått av {{employee_name}}',
   '{{employee_name}} har avslått kontrakten. Vennligst følg opp med den ansatte.',
   'email', now()),
  ('contract', 'contract.employee.declined', 'en',
   'Contract declined by {{employee_name}}',
   '{{employee_name}} has declined the contract. Please follow up with the employee.',
   'email', now()),

  -- contract.employee.expired.admin
  ('contract', 'contract.employee.expired.admin', 'no',
   'Kontrakt utløpt — {{employee_name}}',
   'Kontrakten for {{employee_name}} har utløpt uten signering. Vurder å sende en ny kontrakt.',
   'email', now()),
  ('contract', 'contract.employee.expired.admin', 'en',
   'Contract expired — {{employee_name}}',
   'The contract for {{employee_name}} has expired without being signed. Consider sending a new contract.',
   'email', now()),

  -- contract.employee.expired.employee
  ('contract', 'contract.employee.expired.employee', 'no',
   'Kontrakten din har utløpt',
   'Hei {{employee_name}}, kontrakten din har utløpt. Kontakt din leder for videre informasjon.',
   'email', now()),
  ('contract', 'contract.employee.expired.employee', 'en',
   'Your contract has expired',
   'Hi {{employee_name}}, your contract has expired. Contact your manager for further information.',
   'email', now()),

  -- contract.employee.reminder
  ('contract', 'contract.employee.reminder', 'no',
   'Påminnelse: Signer kontrakten din',
   'Hei {{employee_name}}, du har fortsatt en usignert kontrakt. Vennligst logg inn og signer så snart som mulig.',
   'email', now()),
  ('contract', 'contract.employee.reminder', 'en',
   'Reminder: Sign your contract',
   'Hi {{employee_name}}, you still have an unsigned contract. Please log in and sign it as soon as possible.',
   'email', now())

ON CONFLICT DO NOTHING;
