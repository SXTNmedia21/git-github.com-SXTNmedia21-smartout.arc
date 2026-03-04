SET search_path TO public, extensions;

-- Contract reminder message templates (Journey A: Self-Service Trial)
INSERT INTO message_template (key, channel, category, subject_no, subject_en, body_no, body_en, cta_label_no, cta_label_en, cta_url_template, sms_body_no, sms_body_en)
VALUES
  -- Day 0: Welcome
  ('contract.welcome', 'email', 'contract',
   'Velkommen til Smartout!', 'Welcome to Smartout!',
   'Hei {{client_contact_name}},\n\nVelkommen til Smartout! Din prøveperiode er i gang. Du har 14 dager til å utforske plattformen.\n\nFor å aktivere alle funksjoner, signer avtalen din.',
   'Hi {{client_contact_name}},\n\nWelcome to Smartout! Your trial is active. You have 14 days to explore the platform.\n\nTo unlock all features, sign your agreement.',
   'Signer avtale', 'Sign agreement',
   'https://smartout.io/sign/{{token}}', NULL, NULL),

  -- Day 3: Soft nudge
  ('contract.reminder.day3', 'email', 'contract',
   'Slik får du mest ut av Smartout', 'Getting the most out of Smartout',
   'Hei {{client_contact_name}},\n\nDu har nå brukt Smartout i 3 dager. Har du sett vaktplanleggeren? Den sparer ledere 6+ timer per uke.\n\nSigner avtalen for å sikre full tilgang etter prøveperioden.',
   'Hi {{client_contact_name}},\n\nYou''ve been using Smartout for 3 days. Have you tried the shift planner? It saves managers 6+ hours per week.\n\nSign the agreement to keep full access after the trial.',
   'Signer nå', 'Sign now',
   'https://smartout.io/sign/{{token}}', NULL, NULL),

  -- Day 7: Halfway
  ('contract.reminder.day7', 'email', 'contract',
   'Halvveis i prøveperioden', 'Halfway through your trial',
   'Hei {{client_contact_name}},\n\nDu er halvveis i prøveperioden. {{usage_stats}}\n\nSigner avtalen innen {{trial_ends_at}} for å beholde tilgang.',
   'Hi {{client_contact_name}},\n\nYou''re halfway through your trial. {{usage_stats}}\n\nSign the agreement by {{trial_ends_at}} to keep access.',
   'Signer avtale', 'Sign agreement',
   'https://smartout.io/sign/{{token}}',
   'Smartout: Halvveis i prøveperioden. Signer avtalen for å beholde tilgang: {{short_url}}',
   'Smartout: Halfway through your trial. Sign to keep access: {{short_url}}'),

  -- Day 10: Urgent
  ('contract.reminder.day10', 'email', 'contract',
   '4 dager igjen av prøveperioden', '4 days left in your trial',
   'Hei {{client_contact_name}},\n\nDu har 4 dager igjen. Etter {{trial_ends_at}} blir kontoen skrivebeskyttet.\n\nSigner nå for å unngå avbrudd.',
   'Hi {{client_contact_name}},\n\nYou have 4 days left. After {{trial_ends_at}} your account becomes read-only.\n\nSign now to avoid interruption.',
   'Signer nå', 'Sign now',
   'https://smartout.io/sign/{{token}}', NULL, NULL),

  -- Day 13: Last day
  ('contract.reminder.day13', 'email', 'contract',
   'Siste dag - prøveperioden utløper i morgen', 'Last day - your trial expires tomorrow',
   'Hei {{client_contact_name}},\n\nPrøveperioden utløper i morgen. Signer avtalen NÅ for å beholde tilgang til alle data og funksjoner.',
   'Hi {{client_contact_name}},\n\nYour trial expires tomorrow. Sign the agreement NOW to keep access to all data and features.',
   'Signer avtale', 'Sign agreement',
   'https://smartout.io/sign/{{token}}',
   'Smartout: Siste dag! Prøveperioden utløper i morgen. Signer: {{short_url}}',
   'Smartout: Last day! Trial expires tomorrow. Sign: {{short_url}}'),

  -- Day 14: Expired
  ('contract.reminder.expired', 'email', 'contract',
   'Prøveperioden er utløpt', 'Your trial has expired',
   'Hei {{client_contact_name}},\n\nPrøveperioden er utløpt. Kontoen er nå skrivebeskyttet. Du kan fortsatt se dataene dine, men ikke gjøre endringer.\n\nSigner avtalen for å gjenoppta full tilgang.',
   'Hi {{client_contact_name}},\n\nYour trial has expired. Your account is now read-only. You can still view your data but cannot make changes.\n\nSign the agreement to restore full access.',
   'Signer og aktiver', 'Sign and activate',
   'https://smartout.io/sign/{{token}}', NULL, NULL),

  -- Day 21: Data deletion warning
  ('contract.deletion.warning', 'email', 'contract',
   'Dataene dine slettes om 7 dager', 'Your data will be deleted in 7 days',
   'Hei {{client_contact_name}},\n\nKontoen din har vært inaktiv i 21 dager. Om 7 dager slettes alle data permanent.\n\nDu kan eksportere dataene dine eller signere avtalen for å beholde kontoen.',
   'Hi {{client_contact_name}},\n\nYour account has been inactive for 21 days. In 7 days all data will be permanently deleted.\n\nYou can export your data or sign the agreement to keep your account.',
   'Eksporter data', 'Export data',
   'https://smartout.io/dashboard/settings/export',
   'Smartout: Dataene dine slettes om 7 dager. Eksporter eller signer: {{short_url}}',
   'Smartout: Your data will be deleted in 7 days. Export or sign: {{short_url}}'),

  -- Journey B: Sales-assisted initial send
  ('contract.sales.sent', 'email', 'contract',
   'Avtale fra Smartout', 'Agreement from Smartout',
   'Hei {{client_contact_name}},\n\nVedlagt finner du avtalen mellom {{client_company_name}} og Smartout AS.\n\nVennligst gjennomgå og signer avtalen digitalt.',
   'Hi {{client_contact_name}},\n\nPlease find attached the agreement between {{client_company_name}} and Smartout AS.\n\nPlease review and sign the agreement digitally.',
   'Gjennomgå og signer', 'Review and sign',
   'https://smartout.io/sign/{{token}}', NULL, NULL),

  -- Journey B: Not viewed after 3 days
  ('contract.sales.reminder.day3', 'email', 'contract',
   'Påminnelse: Avtale venter på signering', 'Reminder: Agreement awaiting signature',
   'Hei {{client_contact_name}},\n\nVi sendte deg en avtale for 3 dager siden. Den venter fortsatt på gjennomgang.\n\nHar du spørsmål? Svar på denne e-posten.',
   'Hi {{client_contact_name}},\n\nWe sent you an agreement 3 days ago. It''s still awaiting review.\n\nHave questions? Reply to this email.',
   'Åpne avtale', 'Open agreement',
   'https://smartout.io/sign/{{token}}', NULL, NULL)
ON CONFLICT (key) DO NOTHING;
