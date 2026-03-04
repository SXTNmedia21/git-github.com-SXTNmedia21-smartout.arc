SET search_path TO public, extensions;

-- ============================================
-- 20260304300000_seed_daily_close_process.sql
-- Seeds the DailyClose process definition + triggers.
-- Maps PD state machine: OPEN → CLOSING → VALIDATION → APPROVAL → CLOSED
-- ============================================

-- ── Process ────────────────────────────────────────────────

INSERT INTO engine_process (id, name, description) VALUES
('daily_close', 'Daily Close & Reconciliation',
 'Two-phase daily reconciliation: employee settlement → admin approval. Source: PD + Module 10.')
ON CONFLICT (id) DO NOTHING;

-- ── Steps ──────────────────────────────────────────────────
-- Groups: 1 = parallel close tasks, 2 = parallel validation, NULL = sequential

INSERT INTO engine_step (process_id, step_order, step_group, action_type, action_payload, assignee_rule) VALUES

-- Group 1: Closing employee performs these in parallel
('daily_close', 1, 1, 'assign_task', '{
  "task": "complete_closing_checklist",
  "description": "Complete all closing tasks (micka, lock cash, check fridge temp, security)"
}', 'self'),

('daily_close', 2, 1, 'assign_task', '{
  "task": "upload_settlement_images",
  "description": "Upload POS closing report + iSettle terminal settlement (minimum 2 images)",
  "min_images": 2,
  "required_types": ["pos", "terminal"]
}', 'self'),

-- Sequential: wait for images before running OCR
('daily_close', 3, NULL, 'validate_settlement', '{
  "description": "Run OCR on uploaded images, extract financial data, cross-validate POS vs terminal",
  "tolerance_type": "policy",
  "fallback": "manual_input"
}', null),

-- Sequential: check OCR result + create deviation if mismatch
('daily_close', 4, NULL, 'create_deviation', '{
  "condition": "settlement_mismatch",
  "domain": "system",
  "subcategory": "settlement_mismatch",
  "severity": "medium",
  "auto_create": true,
  "description": "Auto-created when POS vs terminal difference exceeds threshold"
}', null),

-- Gatekeeper: hard lock — employee cannot checkout until all conditions met
('daily_close', 5, NULL, 'lock_checkout', '{
  "description": "Block punch-out until all conditions are met",
  "conditions": [
    "closing_checklist_complete",
    "settlement_images_uploaded",
    "ocr_validated_or_manual",
    "critical_deviations_commented",
    "reconciliation_submitted"
  ]
}', null),

-- Employee submits → status = SUBMITTED
('daily_close', 6, NULL, 'update_entity', '{
  "entity": "daily_reconciliation",
  "set": {"status": "submitted"},
  "description": "Mark reconciliation as submitted by closing employee"
}', 'self'),

-- Wait for manager approval (next business day)
('daily_close', 7, NULL, 'wait_for_event', '{
  "event": "reconciliation.admin_action",
  "timeout": "72h",
  "on_timeout": "escalate",
  "description": "Wait for admin to approve, reject, or request clarification"
}', null),

-- If rejected → notify employee, loop back
('daily_close', 8, NULL, 'send_notification', '{
  "template": "reconciliation_feedback",
  "description": "Notify closing employee of admin decision (approval/rejection/clarification)",
  "channel": "push"
}', null),

-- Final: lock the day
('daily_close', 9, NULL, 'update_entity', '{
  "entity": "daily_reconciliation",
  "set": {"status": "approved"},
  "description": "DAY CLOSED — reconciliation approved and locked"
}', null),

-- Fire completion event for downstream (KPI calculation, season aggregation)
('daily_close', 10, NULL, 'send_notification', '{
  "template": "day_closed",
  "channel": "system",
  "description": "Fire day_closed event for KPI dashboard and season reconciliation"
}', null)
ON CONFLICT (process_id, step_order) DO NOTHING;

-- ── Triggers ───────────────────────────────────────────────

-- Trigger 1: Department session moves to pending_signoff → start close
INSERT INTO engine_trigger (event_type, process_id, condition, is_active)
SELECT 'department_session.pending_signoff', 'daily_close', null, true
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger WHERE event_type = 'department_session.pending_signoff' AND process_id = 'daily_close'
);

-- Trigger 2: Last punch-out for department → start close (fallback)
INSERT INTO engine_trigger (event_type, process_id, condition, delay_seconds, is_active)
SELECT 'shift.last_checkout', 'daily_close', null, 300, true  -- 5min delay
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger WHERE event_type = 'shift.last_checkout' AND process_id = 'daily_close'
);
