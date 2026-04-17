-- strike-mcp Tier 2 extraction (content-extraction approach)
-- entity: confirmation
-- workspace: 65532a8c-9571-5e8f-8890-f551ed242795
-- workspace_slug: wrightegaarden
-- generated: 2026-04-17T18:23:31.793Z
-- rows: 2
-- REVIEW BEFORE APPLYING
-- DRY-RUN ONLY — inherits Tier 1 strike-auth-bridge gate
-- See docs/superpowers/specs/2026-04-17-tier2-content-extraction.md

BEGIN;
INSERT INTO public.confirmation (confirmation_id, protocol_id, name, provenance, confirmation_text, requires_signature, is_active) VALUES ('80506418-512c-5f2a-a90a-5edef9419c4d', '845d5b9b-bd2c-5d71-beb6-9b76e4fa8e91', 'Velkommen til Wrightegaarden', '{"origin":"bubble-import","bubble_id":"1739875380227x949106749402513400","migrated_at":"2026-04-17T18:23:31.790Z","tenant":"wrightegaarden","batch":"2026-04-17T18:23:31.789Z"}', 'Kjære ansatt!

Det er med stor glede vi ønsker deg velkommen som ansatt ved Wrightegaarden sesongen 2024. 

Wrightegaarden er ikke bare et ikonisk konsertsted der mange store artister har opptrådt, men også en gastronomisk destinasjon med en dyp forpliktelse til matkvalitet og service. Vår stolthet ligger i å kunne tilby våre gjester en autentisk og smakfull matopplevelse som komplementerer atmosfæren og historien til dette storslåtte stedet.

Ditt engasjement som en del av vårt team vil bidra til å skape minneverdige øyeblikk for våre gjester, og sammen vil vi opprettholde vårt høye nivå av kvalitet og service.
(Ja, denne teksten er skrevet av AI, men fortsatt sant)

Vi ser frem til å samarbeide med deg og ønsker deg all mulig suksess i din nye rolle.

Med vennlig hilsen, Jørn Akerhaugen. Daglig leder.', false, true) ON CONFLICT (confirmation_id) DO NOTHING;
INSERT INTO public.confirmation (confirmation_id, protocol_id, name, provenance, confirmation_text, requires_signature, is_active) VALUES ('2094bc34-be75-5e83-a69e-b827951aab46', '845d5b9b-bd2c-5d71-beb6-9b76e4fa8e91', 'Tildekking & rydding av bord', '{"origin":"bubble-import","bubble_id":"1739875384487x997970207359369200","migrated_at":"2026-04-17T18:23:31.790Z","tenant":"wrightegaarden","batch":"2026-04-17T18:23:31.789Z"}', 'Tildekking & rydding av bord', false, true) ON CONFLICT (confirmation_id) DO NOTHING;

COMMIT;
