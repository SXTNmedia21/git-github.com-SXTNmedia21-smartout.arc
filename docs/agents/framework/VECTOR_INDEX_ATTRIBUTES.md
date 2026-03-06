# Event Motor Vector Index: Attributes & Variables

This document defines the raw attributes, metadata variables, and state definitions that must be captured by the Event Motor to feed the Vector Store. The Index Specialist will use these to calculate weights, factors, multipliers, and overall engagement scores.

---

## 1. Temporal & Contextual Attributes

Attributes defining the absolute context of when and where the event occurred.

- `event_id`: UUID
- `timestamp`: ISO8601 (microsecond precision)
- `session_id`: UUID (ties all events in a single user session)
- `journey_id`: UUID (the specific Roadmap being executed)
- `journey_version`: String (e.g., "1.2.0" to track A/B test iterations)
- `step_id`: String (the specific section/screen within the journey)
- `device_profile`: Enum (mobile, tablet, desktop)
- `network_latency_ms`: Integer (useful for ruling out UI stalls caused by bad connections)

## 2. Actor Attributes

Attributes defining _who_ performed the action.

- `actor_type`: Enum (`user` | `agent_botsson` | `agent_system` | `playwright_e2e`)
- `actor_id`: UUID (null if unauthenticated)
- `agent_model_version`: String (e.g., "claude-3-opus-20240229" if actor is an agent)

## 3. Interaction & Engagement Variables

Attributes defining the exact physical or programmatic interaction with the DOM.

- `action_type`: Enum (`focus_in` | `focus_out` | `keystroke_batch` | `click` | `scroll` | `voice_input_start` | `voice_input_end`)
- `target_component_id`: String (e.g., "input_org_number")
- `target_component_type`: Enum (`text_input` | `dropdown` | `radio_group` | `button_primary` | `dynamic_list`)
- `time_to_first_interaction_ms`: Integer (time from component mount to first user/agent action)
- `time_on_element_ms`: Integer (total time the element held focus)
- `scroll_depth_percent`: Float (0.0 to 1.0, how far down the user scrolled the section)

## 4. Friction & Quality Variables

Critical signals used to calculate the UX/Engagement Score.

- `validation_error_count`: Integer (how many times a field failed validation before success)
- `backspace_count`: Integer (indicates user hesitation or rewriting)
- `rage_click_count`: Integer (rapid successive clicks on the same non-responsive element)
- `agent_correction_flag`: Boolean (true if user overwrote data previously filled by the agent)
- `stall_duration_ms`: Integer (continuous time with no keyboard, mouse, or voice input)
- `whisper_triggered_flag`: Boolean (true if the Guardian had to intervene due to a stall or error)
- `abandonment_flag`: Boolean (true if this was the last event before the session died)

## 5. Agent UI Control Variables (AG-UDI specific)

Attributes tracking how the Agent manipulated the UI framework.

- `tool_executed`: String (e.g., "updateBusiness", "advanceToNextSection")
- `tool_execution_duration_ms`: Integer
- `schema_mutation_flag`: Boolean (true if the agent dynamically swapped a component schema via `proposeComponentReplacement`)
- `previous_schema_hash`: String (hash of the UI before mutation)
- `new_schema_hash`: String (hash of the UI after mutation)

## 6. Functional & Outcome Variables

Attributes defining the success state of the Journey/Roadmap.

- `step_completion_status`: Enum (`success` | `skipped` | `failed` | `abandoned`)
- `data_completeness_percent`: Float (0.0 to 1.0, e.g., how many optional fields were filled)
- `e2e_assertion_result`: Boolean (from the Playwright test gate)
- `e2e_failure_reason`: String (null if passed)
