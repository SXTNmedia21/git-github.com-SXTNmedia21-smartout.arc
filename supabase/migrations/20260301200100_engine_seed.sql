-- ============================================
-- 20260301200100_engine_seed.sql
-- Seeds a test mission "discovery-call" with 3 stages for E2E testing.
-- This is a global mission (workspace_id = NULL) used for development.
-- Connected to: BREAKDOWN.md Epic 7.1
-- ============================================

-- Discovery call mission — 3-stage sequential flow
INSERT INTO engine_missions (id, name, description, mode, context_source, workspace_id, is_active)
VALUES (
  'discovery-call',
  'Discovery Call',
  'A 3-stage discovery call that learns about the caller, their problem, and confirms understanding.',
  'sequential',
  NULL,
  NULL,
  true
);

-- Stage 1: Greeting — learn who they are
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  escalation_instructions, personality_override, emotion_hint, creative_freedom,
  next_stage, is_required
) VALUES (
  'discovery-call',
  'greeting',
  1,
  'Learn the persons name and role in their organization.',
  'Greet the person warmly. Ask for their name and what they do. Be friendly and natural — this is the first impression. Do not rush. Let them talk.',
  'You know their name and their role/title. Both have been stored.',
  'If they seem reluctant, explain that you just want to understand who you are talking to so you can help them better.',
  'Be extra warm and welcoming. First impressions matter.',
  'warmth',
  0.8,
  'problem',
  true
);

-- Stage 2: Problem — understand their challenge
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  escalation_instructions, personality_override, emotion_hint, creative_freedom,
  next_stage, is_required
) VALUES (
  'discovery-call',
  'problem',
  2,
  'Understand the main challenge or problem they are facing.',
  'Ask what brought them here today. Listen actively. Ask follow-up questions to understand the root cause, not just symptoms. Summarize what you heard to confirm understanding.',
  'You can clearly articulate their main problem in one sentence. The problem description has been stored.',
  'If they are vague, ask for a specific example. "Can you give me an example of when this happened?"',
  'Be empathetic and curious. Show that you genuinely want to understand.',
  'empathy',
  0.7,
  'confirm',
  true
);

-- Stage 3: Confirm — summarize and verify
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  escalation_instructions, personality_override, emotion_hint, creative_freedom,
  next_stage, is_required
) VALUES (
  'discovery-call',
  'confirm',
  3,
  'Summarize what you learned and confirm with the person that you understood correctly.',
  'Summarize: their name, role, and main problem. Ask "Did I get that right?" If they correct you, update your understanding. End by thanking them and explaining what happens next.',
  'The person has confirmed that your summary is accurate. Confirmation has been stored.',
  'If they disagree with your summary, apologize and ask them to explain again. Do not argue.',
  'Be confident but humble. You are confirming, not lecturing.',
  'confidence',
  0.6,
  NULL,
  true
);
