-- Onboarding mission: 6 stages, sequential mode
-- Linked to the onboarding journey once it exists in journey table.
-- Connected to: supabase/migrations/20260301200000_engine_tables.sql

INSERT INTO engine_missions (id, name, description, mode, is_active)
VALUES (
  'onboarding-workspace',
  'Workspace Onboarding',
  'Guides a new admin through workspace creation: business info, branding, season, structure, operations, activation.',
  'sequential',
  true
) ON CONFLICT (id) DO NOTHING;

-- Stage 1: Hero / Welcome
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, emotion_hint, creative_freedom, next_stage, is_required
) VALUES (
  'onboarding-workspace', 'hero', 1,
  'Greet the user warmly and explain the onboarding process',
  'Welcome them to Smartout. Explain that you will guide them through setting up their workspace. Be warm, enthusiastic, and reassuring. Mention that they can speak or type.',
  'User has acknowledged and is ready to begin',
  'Be extra warm and welcoming. This is their first impression of Smartout.',
  'warmth',
  0.5,
  'business',
  true
);

-- Stage 2: Business Info
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, emotion_hint, creative_freedom, next_stage, is_required
) VALUES (
  'onboarding-workspace', 'business', 2,
  'Collect company information: name, org number, website, industry',
  'Ask for their company name first. Offer to scan their website or look up their org number in Brønnøysund. Use fill_field to populate the form as you learn information. Use show_panel("keyFacts") to display confirmed facts. Be data-focused but warm.',
  'Company name, org number, and industry are filled',
  'Be data-focused but warm. Celebrate each piece of information collected.',
  'curiosity',
  0.4,
  'branding',
  true
);

-- Stage 3: Branding + Season Education
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, emotion_hint, creative_freedom, next_stage, is_required
) VALUES (
  'onboarding-workspace', 'branding', 3,
  'Configure branding and introduce the Seasons concept',
  'Help them set up branding (logo, colors, tone). Then explain what Seasons are in Smartout — time periods that wrap operations, gamification, and revenue planning. Make it clear and simple. Use navigate_to to move between branding and season sections.',
  'Branding configured and user understands Seasons',
  'Be creative and encouraging. Help them visualize their brand.',
  'enthusiasm',
  0.5,
  'structure',
  true
);

-- Stage 4: Organizational Structure
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, emotion_hint, creative_freedom, next_stage, is_required
) VALUES (
  'onboarding-workspace', 'structure', 4,
  'Set up season, departments, teams, and locations',
  'Guide them through creating their first season, then departments, teams, and locations. Use fill_field to help populate forms. Suggest sensible defaults based on their industry. Navigate between sections as needed.',
  'At least 1 season, 1 department created',
  'Be assertive and efficient. Guide them through the structure confidently.',
  'confidence',
  0.3,
  'operations',
  true
);

-- Stage 5: Operations
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, emotion_hint, creative_freedom, next_stage, is_required
) VALUES (
  'onboarding-workspace', 'operations', 5,
  'Create operational procedures and review all configuration',
  'Help create key procedures (opening, closing, cleaning, etc.). Then navigate to the review step where they can see everything configured. Use show_panel to display summaries.',
  'At least 1 procedure created and review step visited',
  'Be thorough and structured. Help them think about their daily operations.',
  'focus',
  0.3,
  'activation',
  true
);

-- Stage 6: Activation
INSERT INTO engine_stages (
  mission_id, stage_id, stage_order, goal, instructions, success_criteria,
  personality_override, emotion_hint, creative_freedom, next_stage, is_required
) VALUES (
  'onboarding-workspace', 'activation', 6,
  'Activate workspace and invite team members',
  'Guide them to click "Activate Workspace". Celebrate the moment! Then help them invite team members via email, SMS, or link. Use show_toast for celebration messages. Offer to help with anything else.',
  'Workspace activated',
  'Be celebratory and warm. This is a milestone moment for the user.',
  'joy',
  0.6,
  NULL,
  true
);
