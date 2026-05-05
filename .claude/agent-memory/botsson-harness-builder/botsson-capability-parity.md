---
name: Botsson capability parity (chat vs voice)
description: Which capabilities are registered in BOTSSON_CAPABILITIES in agents/botsson.ts vs voice tool surface
type: project
---

After Phase 0d (2026-04-30):

**agents/botsson.ts BOTSSON_CAPABILITIES (23 capabilities, full registry):**
contract, contractIntake, operations, operationsIntelligence, schedule, guardian,
shiftSwap, shiftLifecycle, governance, training, communication, availability,
profile, ui, memory, mission, kbQuery, helpdeskQuery, personal, payroll, legal, billingQuery

**voice-agent tool surface (22 tools via ask() bridge):**
- Orb: expand, collapse, pulse, pin, unpin, move, set_state (7)
- Personal: add_note, create_task, set_reminder, get_history, update_setting (5)
- Capability proxies: query_smartout (fallback), get_my_shifts, get_my_missions,
  cite_legal_paragraph, get_training_progress, get_helpdesk_status, get_my_profile,
  get_operations_summary, get_shift_swap_status, get_governance_summary, get_knowledge (11)

**Channel enforcement:**
- Chat path: all 23 capabilities available; ADR-0078 enforced at tool execute-time
- Voice path: ask() sends channel="voice"; stage-engine Layer 3 rejects payroll,
  validate_aml_14_6, contract mutations, etc.

**journeyCapability and journeyAuthoringCapability are NOT in BOTSSON_CAPABILITIES:**
- ADR-0173 frozen-4 boundaries: journey authoring is web-only admin surface
- Voice authoring forbidden (ADR-0133 mobile boundary = no authoring on thin clients)
