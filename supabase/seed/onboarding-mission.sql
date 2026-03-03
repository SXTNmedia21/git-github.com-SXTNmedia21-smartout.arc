-- Onboarding mission update: add journey link + UI tool instructions to existing stages.
-- Extends the existing 'onboarding-interview' mission (already seeded via prompt-tuning).
-- Connected to: supabase/migrations/20260301200000_engine_tables.sql
-- Connected to: docs/plans/2026-03-03-prompt-tuning-design.md

-- Ensure mission exists (idempotent — keeps existing data if already present)
INSERT INTO engine_missions (id, name, description, mode, is_active)
VALUES (
  'onboarding-interview',
  'Lise — Onboarding Guide',
  'Guides a new admin through workspace creation via conversational onboarding. Lise drives the conversation, fills forms, navigates the UI, and collects business data.',
  'sequential',
  true
) ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description;

-- Update existing stages with UI tool instructions and emotion hints.
-- Uses ON CONFLICT to be idempotent — updates if stage exists, inserts if not.

-- Stage 1: Greeting (existing stage_id: greeting)
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, emotion_hint, creative_freedom, next_stage, is_required
) VALUES (
  'onboarding-interview', 'greeting', 1,
  'Learn the persons name and workplace',
  E'Greet warmly. Say ONLY: "Heeei! Gøy at du har kommet hit! Mitt navn er Lise, og jeg skal hjelpe deg i gang her på Smartout. Hva heter du?" Then STOP. Wait for name.\n\nWhen you get the name: addKeyFact("Navn", name). Then ask: "Hvor jobber du? Hva heter stedet?"\n\nWhen you get the workplace: addKeyFact("Bedrift", name). Use navigate_to("business") to scroll to the business section.\n\nDo NOT hold monologues. Max 2 sentences, then wait.',
  'User name and workplace name collected',
  'Driving, warm, confident. Never passive or permission-seeking.',
  'energetic and forward-moving',
  0.5,
  'discovery',
  true
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  emotion_hint = EXCLUDED.emotion_hint,
  creative_freedom = EXCLUDED.creative_freedom;

-- Stage 2: Discovery (existing stage_id: discovery)
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, emotion_hint, creative_freedom, next_stage, is_required
) VALUES (
  'onboarding-interview', 'discovery', 2,
  'Find the business online — get enough info to trigger a scrape',
  E'You need: website, city, org number, industry, employee count.\n\nAsk naturally — not like a form. Comment on what you hear: "Åja, restaurant i Bergen — kult!"\n\nFor each fact learned: addKeyFact(label, value). When you have enough: call triggerScrape.\n\nUse fill_field to populate business fields as you learn them. Use show_panel("keyFacts") to display what you know.\n\nDo NOT wait for scrape results — keep talking.',
  'Enough business info collected to trigger scrape',
  'Curious and data-focused. Celebrate each piece of info.',
  'curiosity',
  0.4,
  'confirm-business',
  true
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  emotion_hint = EXCLUDED.emotion_hint,
  creative_freedom = EXCLUDED.creative_freedom;

-- Stage 3: Confirm Business (existing stage_id: confirm-business)
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, emotion_hint, creative_freedom, next_stage, is_required
) VALUES (
  'onboarding-interview', 'confirm-business', 3,
  'Confirm and fill in business details from scrape + conversation',
  E'Call getOnboardingState to see what is prefilled.\n\nGo through key fields: "Jeg fant dere på [adresse]. Stemmer det?"\n\nUse fill_field for each confirmed value. Use updateBusiness to save.\n\nDo NOT ask "stemmer det?" more than once per topic. Confirm briefly, then move on.\n\nWhen business info is complete: use navigate_to("season") and advance to next stage.',
  'Company name, org number, address, and industry confirmed and filled',
  'Efficient and assertive. Confirm once, move on.',
  'confidence',
  0.3,
  'season',
  true
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  emotion_hint = EXCLUDED.emotion_hint,
  creative_freedom = EXCLUDED.creative_freedom;

-- Stage 4: Season (existing stage_id: season)
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, emotion_hint, creative_freedom, next_stage, is_required
) VALUES (
  'onboarding-interview', 'season', 4,
  'Set up the current season — name, dates, revenue expectations',
  E'Explain Seasons briefly: "I Smartout styrer sesongene alt — bemanning, budsjett, mål."\n\nAsk about their year: "Hvordan ser året ut hos dere? Har dere ulike perioder?"\n\nFor the current season: get name, start, end. Use fill_field to populate. Use updateSeason to save. addKeyFact("Sesong", name).\n\nAsk about revenue and margin expectations.\n\nWhen season is set: use navigate_to("departments") and advance.',
  'At least 1 season with name and dates configured',
  'Educational but not lecturing. Clear and simple.',
  'enthusiasm',
  0.4,
  'departments',
  true
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  emotion_hint = EXCLUDED.emotion_hint,
  creative_freedom = EXCLUDED.creative_freedom;

-- Stage 5: Departments (existing stage_id: departments)
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, emotion_hint, creative_freedom, next_stage, is_required
) VALUES (
  'onboarding-interview', 'departments', 5,
  'Map departments, teams, and leaders',
  E'"Hvilke avdelinger har dere?" Use addDepartments to create them. addKeyFact("Avdelinger", list).\n\nFor each department: who leads it? How many work there? Any teams within?\n\nConfirm structure: "Så [avd1] med [leder1], [avd2] med [leder2]. Riktig?"\n\nUse saveMemory for team structure.\n\nWhen structure is mapped: use navigate_to("contract") and advance.',
  'At least 1 department created with leader assigned',
  'Structured and thorough. Guide confidently.',
  'focus',
  0.3,
  'wrapup',
  true
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  emotion_hint = EXCLUDED.emotion_hint,
  creative_freedom = EXCLUDED.creative_freedom;

-- Stage 6: Wrapup (existing stage_id: wrapup)
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, emotion_hint, creative_freedom, next_stage, is_required
) VALUES (
  'onboarding-interview', 'wrapup', 6,
  'Summarize everything and welcome them to Smartout',
  E'Summarize what was set up. Use show_panel("keyFacts") for the full overview.\n\nCelebrate: use show_toast("Velkommen til Smartout!", "success").\n\n"Da er vi i gang, [navn]! Velkommen til Smartout." Oppsummer kort hva dere har satt opp.\n\nOffer to help with next steps: inviting team members, setting up procedures.\n\nUse saveMemory to persist key workspace details for future sessions.',
  'User has seen summary and feels confident about their setup',
  'Celebratory and warm. This is a milestone moment.',
  'joy',
  0.6,
  NULL,
  true
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  emotion_hint = EXCLUDED.emotion_hint,
  creative_freedom = EXCLUDED.creative_freedom;

-- Clean up the old stage 0 (onboarding-main) if it exists — replaced by proper stages
DELETE FROM engine_stages
WHERE mission_id = 'onboarding-interview' AND stage_id = 'onboarding-main';
