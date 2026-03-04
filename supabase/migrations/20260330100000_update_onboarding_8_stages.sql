-- Update onboarding-interview mission from 6 stages to 8 stages.
-- Adds: locations (6), procedures (7), welcome (8).
-- Removes: wrapup (replaced by 3 new stages).
-- Idempotent via ON CONFLICT.

-- Step 0: Delete old wrapup stage FIRST — frees stage_order=6 for new 'locations' stage
DELETE FROM engine_stages
WHERE mission_id = 'onboarding-interview' AND stage_id = 'wrapup';

-- Step 1: Update departments stage — point to 'locations' and fix instructions to use real tools
UPDATE engine_stages
SET
  next_stage = 'locations',
  instructions = E'"Hvilke avdelinger har dere?" Use addDepartments to create them. addKeyFact("Avdelinger", list).\n\nFor each department: who leads it? How many work there? Any teams within?\n\nConfirm structure: "Så [avd1] med [leder1], [avd2] med [leder2]. Riktig?"\n\nUse saveMemory for team structure.\n\nWhen structure is mapped: call advanceToNextSection to scroll the UI, then call advance with a summary of departments created.'
WHERE mission_id = 'onboarding-interview' AND stage_id = 'departments';

-- Step 1b: Fix greeting stage — ask for name and workplace, trigger auto-scrape
UPDATE engine_stages
SET instructions = E'You speak first. Greet warmly and energetically — introduce yourself as Lise, say you will help them get started on Smartout, and ask their name. Keep it to 1-2 sentences. Be enthusiastic!\n\nWhen you get the name: addKeyFact("Navn", name). Then ask: "Hva heter arbeidsplassen din, og hvor ligger den?"\n\nWhen you get the workplace name and city: addKeyFact("Bedrift", name). Call triggerScrape with companyName and city (NOT url or orgNumber). Then call advanceToNextSection to scroll to the Big Board.\n\nDo NOT ask for website or org number — the system finds everything from just the name.\nDo NOT repeat your greeting. Do NOT hold monologues. Max 2 sentences, then wait.',
  success_criteria = 'User name, workplace name and city collected. Scrape triggered.'
WHERE mission_id = 'onboarding-interview' AND stage_id = 'greeting';

-- Step 1c: Fix confirm-business stage — quick gap-fill after Big Board
UPDATE engine_stages
SET instructions = E'The user has confirmed the Big Board. Now do a quick pass on remaining details.\n\nCall getOnboardingState — check if any key fields are missing (email, phone, description).\n\nIf something is missing, ask briefly: "Hva er e-posten til bedriften?" Use updateBusiness to save.\n\nDo NOT repeat what the Big Board already shows — only fill gaps.\nMax 2-3 follow-up questions, then move on.\n\nWhen business info is complete: call advanceToNextSection to scroll to season section, then advance.',
  success_criteria = 'All key business fields filled — name, address, industry, contact info'
WHERE mission_id = 'onboarding-interview' AND stage_id = 'confirm-business';

-- Step 1d: Fix season stage — replace phantom tools with real ones
UPDATE engine_stages
SET instructions = E'Explain Seasons briefly: "I Smartout styrer sesongene alt — bemanning, budsjett, mål."\n\nAsk about their year: "Hvordan ser året ut hos dere? Har dere ulike perioder?"\n\nFor the current season: get name, start, end. Use updateSeason to save. addKeyFact("Sesong", name).\n\nAsk about revenue and margin expectations.\n\nWhen season is set: call advanceToNextSection to scroll to departments section, then call advance with season data.'
WHERE mission_id = 'onboarding-interview' AND stage_id = 'season';

-- Step 2: Insert new stage 6 — Locations
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, creative_freedom, tuning_notes, next_stage
) VALUES (
  'onboarding-interview', 'locations', 6,
  'Map physical locations and zones within them',
  E'Ask: "Hvor holder dere til? Har dere flere lokaler?"\n\nFor each location mentioned: call addLocations with name and type (main/outdoor/satellite).\n\nThen ask about zones: "Har restauranten forskjellige soner? F.eks. bar-område, spisesal?"\n\nFor each zone: call addZones(locationName, zones).\n\naddKeyFact("Lokasjoner", list of names).\n\nWhen done: call advanceToNextSection to scroll the UI, then call advance with a summary of the locations collected.',
  'At least 1 location created',
  'Practical and organized. Help them think about their space.',
  0.4,
  'structured-friendly',
  'procedures'
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  stage_order = EXCLUDED.stage_order,
  goal = EXCLUDED.goal,
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  creative_freedom = EXCLUDED.creative_freedom,
  tuning_notes = EXCLUDED.tuning_notes,
  next_stage = EXCLUDED.next_stage;

-- Step 3: Insert new stage 7 — Procedures
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, creative_freedom, tuning_notes, next_stage
) VALUES (
  'onboarding-interview', 'procedures', 7,
  'Quick intro to governance — select standard procedures for industry',
  E'Based on industry, recommend standard procedures: "For en restaurant anbefaler jeg: Temperaturkontroll, Allergenhåndtering, Åpningsrutine, Stengerutine."\n\nCall addProcedures with the recommended list.\n\nAsk if they want to add more: "Har dere andre viktige rutiner?"\n\nIf yes, call addProcedures with additional names.\n\naddKeyFact("Prosedyrer", count + names).\n\nKeep it quick — say: "Disse kan du tilpasse senere i dashboardet."\n\nWhen done: call advanceToNextSection to scroll the UI, then call advance with a summary of selected procedures.',
  'At least 1 procedure selected',
  'Efficient and knowledgeable. Quick overview, not deep dive.',
  0.3,
  'efficiency',
  'welcome'
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  stage_order = EXCLUDED.stage_order,
  goal = EXCLUDED.goal,
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  creative_freedom = EXCLUDED.creative_freedom,
  tuning_notes = EXCLUDED.tuning_notes,
  next_stage = EXCLUDED.next_stage;

-- Step 4: Insert new stage 8 — Welcome (replaces wrapup)
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, creative_freedom, tuning_notes, next_stage
) VALUES (
  'onboarding-interview', 'welcome', 8,
  'Summarize everything, show contract preview, and welcome to dashboard',
  E'Summarize what was set up — use getOnboardingState to get all data.\n\n"Alt er klart, [navn]! Her er en oppsummering:"\n- Business name, employee count\n- Season name and dates\n- Number of departments\n- Number of locations and zones\n- Number of procedures\n\nMention the contract template is ready.\n\nCall advanceToNextSection to scroll the UI to the welcome screen.\n\nAsk: "Vil du utforske dashboardet selv, eller skal jeg vise deg rundt?"\n\nUse saveMemory to persist key workspace details for future sessions.\nUse store to save a complete summary of the workspace setup.\n\nCelebrate: "Velkommen til Smartout!"\n\nThis is the final stage — do NOT call advance. The session completes here.',
  'User has seen summary and feels confident about their setup',
  'Celebratory and warm. This is a milestone moment.',
  0.6,
  'joy',
  NULL
) ON CONFLICT (mission_id, stage_id) DO UPDATE SET
  stage_order = EXCLUDED.stage_order,
  goal = EXCLUDED.goal,
  instructions = EXCLUDED.instructions,
  success_criteria = EXCLUDED.success_criteria,
  personality_override = EXCLUDED.personality_override,
  creative_freedom = EXCLUDED.creative_freedom,
  tuning_notes = EXCLUDED.tuning_notes,
  next_stage = EXCLUDED.next_stage;

-- Step 5: (moved to Step 0 above — wrapup already deleted)

-- Step 5b: Update discovery stage — Big Board narration instead of form-filling
UPDATE engine_stages
SET instructions = E'The Big Board is now showing on screen with 6 panels filling in automatically.\n\nCall getOnboardingState to see what was found. Narrate the key findings enthusiastically:\n- "Fant [bedrift]! [employeeCount] ansatte, [industry]."\n- If Google rating: "Dere har [rating] på Google — bra!"\n- Comment on departments, locations found.\n\nConfirm with user: "Stemmer dette?"\n\nFor each correction: use updateBusiness to fix.\nDo NOT re-ask for website or org number — that data is already collected.\nDo NOT wait silently — actively walk through what was found.\n\nWhen confirmed: call advanceToNextSection and advance.',
  success_criteria = 'User has confirmed Big Board data is correct'
WHERE mission_id = 'onboarding-interview' AND stage_id = 'discovery';

-- Step 6: Update contract stage to point to welcome
-- (contract sits between procedures and welcome in the section order,
--  but in the engine stage chain, procedures → welcome directly since
--  contract is a UI-only section without an engine stage)
