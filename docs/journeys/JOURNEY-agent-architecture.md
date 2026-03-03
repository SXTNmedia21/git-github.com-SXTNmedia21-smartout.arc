---
title: "User Journeys — Agent Architecture (Mr. Botsson)"
status: done
updated: 2026-03-03
created: 2026-03-03
module: ai
tags: [agent, mr-botsson, authority, config, stage-engine, journeys]
---

# User Journeys — Agent Architecture (Mr. Botsson)

## Journey: Admin Configures Agent Authority Levels

**Precondition:** Admin is logged in, workspace exists, `engine_authority_config` table seeded with default authority levels (all capabilities set to `suggest`).

1. Admin navigates to `/dashboard/ai/config` → System loads authority config for the workspace from `engine_authority_config`
2. System displays a list of all 8 capabilities: Knowledge, Schedule, Training, Operations, Profile, Communication, Memory, Payroll
3. Each capability row shows: name, description, current authority level dropdown (autonomous / confirm / suggest / read_only / disabled)
4. Admin reviews the defaults → All capabilities start at `suggest` level
5. Admin changes Schedule to `autonomous` → System sends PATCH to update `engine_authority_config` for (workspace_id, schedule)
6. Admin changes Knowledge to `autonomous` → System updates row
7. Admin changes Payroll to `read_only` → System updates row
8. System shows success toast: "Authority levels updated"
9. Admin sees the updated levels reflected immediately in the UI

**Postcondition:** Workspace has custom authority levels persisted in `engine_authority_config`. Mr. Botsson will respect these levels for all future conversations in this workspace.

**Error paths:**

- Admin is not owner/admin role → Route guard redirects to dashboard, config page inaccessible
- Network failure on save → Toast error "Could not update authority config", previous value remains
- Invalid authority level (should not happen via UI) → Server returns 400, UI shows validation error
- No `engine_authority_config` rows for workspace → System creates defaults on first load (all `suggest`)

---

## Journey: Admin Sets Capability to "Confirm"

**Precondition:** Admin is on `/dashboard/ai/config`, Operations capability currently set to `autonomous`.

1. Admin locates the Operations capability row
2. Admin opens the authority level dropdown → Sees 5 options: autonomous, confirm, suggest, read_only, disabled
3. Admin selects `confirm` → System updates `engine_authority_config` WHERE (workspace_id, capability='operations') SET authority_level='confirm'
4. System shows success toast

**How "confirm" changes agent behavior (employee side):**

5. Employee asks Mr. Botsson: "Close the lunch session for the restaurant floor"
6. Agent classifies intent → capability: Operations, action: close_department_session
7. Agent checks authority config → Operations is `confirm`
8. Instead of executing, Agent responds: "I can close the lunch session for Restaurant Floor. This will mark it as pending_signoff. Should I proceed?"
9. Employee confirms: "Yes, go ahead"
10. Agent executes the action → Department session status updated to `pending_signoff`
11. Agent responds: "Done. The lunch session for Restaurant Floor is now pending sign-off by a manager."

**Postcondition:** Operations capability requires explicit user confirmation before any action is executed. Agent never acts autonomously for this capability.

**Error paths:**

- Employee says "No" or "Cancel" at confirmation step → Agent responds "Understood, I won't close the session." No action taken.
- Confirmation timeout (session ends before user confirms) → Action is not executed, no side effects
- Underlying operation fails after confirmation → Agent responds with error: "I tried to close the session but it failed: [reason]. You may need to do this manually."

---

## Journey: Admin Disables a Capability

**Precondition:** Admin is on `/dashboard/ai/config`, Payroll capability currently set to `suggest`.

1. Admin locates the Payroll capability row
2. Admin selects `disabled` from the authority level dropdown
3. System updates `engine_authority_config` WHERE (workspace_id, capability='payroll') SET authority_level='disabled'
4. System shows warning dialog: "Disabling Payroll means Mr. Botsson cannot answer any payroll-related questions for employees in this workspace. Confirm?"
5. Admin confirms → System persists the change
6. System shows success toast: "Payroll capability disabled"

**How "disabled" changes agent behavior (employee side):**

7. Employee asks Mr. Botsson: "When do I get paid this month?"
8. Agent classifies intent → capability: Payroll
9. Agent checks authority config → Payroll is `disabled`
10. Agent does NOT load any payroll tools or data
11. Agent responds: "I'm not set up to help with payroll questions in this workspace. Please contact your manager or HR for payroll-related matters."

**Postcondition:** Payroll capability is fully disabled. Agent will not attempt any payroll actions or lookups. No payroll tools are loaded into the LLM context.

**Error paths:**

- Admin disables all capabilities → Agent can still greet and have basic conversation, but cannot perform any domain actions. Agent explains: "I'm currently limited in what I can help with. Please ask your manager to review my configuration."
- Intent classification is ambiguous (payroll + schedule overlap) → Agent falls back to the enabled capability if possible, or explains the limitation

---

## Journey: Employee Chats with Mr. Botsson (Text)

**Precondition:** Employee is logged in, has an active profile in the workspace, stage engine running, OpenRouter API key configured.

1. Employee opens chat interface → System establishes SSE connection to stage engine
2. Employee types: "What are the allergen rules for the shellfish menu?"
3. System sends POST to `/agent/chat` with JWT, message, and profile_id
4. Stage engine validates JWT → Resolves workspace_id from profile
5. System creates or resumes agent session (mode="agent") in `engine_sessions`
6. System loads context in parallel: profile data, workspace settings, authority config, recent memories from `engine_memory`
7. **Intent classification:** Router LLM analyzes the message → Intent: Knowledge capability, action: policy_lookup, confidence: 0.92
8. System checks authority config for Knowledge → Level: `autonomous`
9. System selects Knowledge tools (search_policies, get_protocol_details) and builds tool set
10. System constructs Mr. Botsson system prompt with employee context, workspace rules, and persona
11. System calls LLM with prompt, tools, and conversation history → LLM invokes `search_policies` tool with query "shellfish allergen rules"
12. Tool returns matching policy content from workspace knowledge base
13. LLM generates response incorporating policy content → "According to your workplace's allergen policy, shellfish dishes must be flagged with allergen code 2..."
14. System streams response back via SSE → Employee sees response appear in real-time
15. System persists user + assistant turns to `engine_sessions`

**Postcondition:** Employee received accurate, workspace-specific answer. Conversation persisted in session. No human intervention required (autonomous mode).

**Error paths:**

- No auth header or expired JWT → 401 `AUTH_FAILED` → Chat UI shows "Session expired, please log in again"
- No profile for user in workspace → 401 → Chat UI shows error
- OpenRouter API key missing → 500 → Chat shows "Mr. Botsson is temporarily unavailable"
- Intent classification low confidence (< threshold) → Agent asks clarifying question: "Could you tell me more about what you need? I want to make sure I help you with the right thing."
- No matching policies found → Agent responds honestly: "I couldn't find a specific allergen policy for shellfish in your workspace. You should check with your manager."
- SSE connection drops → Client reconnects automatically, resumes from last message via session_id
- Rate limit exceeded → 429 → Chat shows "Please wait a moment before sending another message"

---

## Journey: Employee Uses Voice with Mr. Botsson (Ultravox)

**Precondition:** Employee is logged in, Ultravox API key configured in stage engine, microphone access granted in browser.

1. Employee clicks the voice/call button in the chat interface
2. System sends POST to `/adapters/ultravox/create-call` with auth header, profile_id, workspace_id
3. Stage engine validates auth → Creates agent session (mode="agent") in `engine_sessions`
4. System loads profile context, authority config, and recent memories
5. System builds Ultravox call configuration:
   - System prompt: Mr. Botsson persona + employee context + workspace rules
   - HTTP tools: registered as callback URLs pointing back to stage engine (store, fetch, advance)
   - Voice settings: Norwegian language, appropriate voice model
6. System calls Ultravox Create Call API → Ultravox returns `call_id` and `join_url`
7. Client receives `join_url` → Connects to Ultravox WebSocket for real-time voice
8. Employee speaks: "Hva er prosedyren for stenging i kveld?"
9. Ultravox transcribes speech → Sends to stage engine via HTTP tool callback
10. Stage engine classifies intent → Operations capability → Checks authority level
11. Stage engine processes request using same capability pipeline as text chat
12. Stage engine returns response text → Ultravox synthesizes speech
13. Employee hears Mr. Botsson's spoken response with the closing procedure details
14. Conversation continues in real-time voice until employee ends the call

**Postcondition:** Employee received voice-based assistance. Session logged in `engine_sessions`. Same capabilities and authority levels as text chat — voice is an adapter, not a separate system.

**Error paths:**

- No Ultravox API key → 500 `Failed to create Ultravox call` → UI shows "Voice is not available. Try text chat instead."
- Microphone permission denied → Browser blocks audio → UI prompts: "Please allow microphone access to use voice"
- Ultravox service unavailable → Call creation fails → UI falls back to text chat suggestion
- Poor audio quality / transcription failure → Ultravox returns low-confidence transcript → Agent asks for clarification
- Network interruption during call → WebSocket disconnects → UI shows "Call ended unexpectedly" with option to reconnect
- `staticParameters` not set on Ultravox tools → Stage engine receives no auth context → 401 on tool callbacks (known trap, see ADR/learning log)

---

## Journey: Agent Stores Memory

**Precondition:** Employee is in an active conversation with Mr. Botsson, `engine_memory` table exists with pgvector extension enabled.

1. During conversation, employee mentions: "I'm allergic to latex gloves, I always need the nitrile ones"
2. Agent recognizes this as personally relevant information worth remembering
3. Agent invokes the Memory capability's `store_memory` tool with:
   - content: "Employee is allergic to latex gloves, requires nitrile gloves"
   - memory_type: "preference" (other types: "fact", "context", "instruction")
   - profile_id: employee's profile ID
   - workspace_id: current workspace
4. Stage engine generates embedding for the memory content via embedding model → Returns vector (pgvector format)
5. System inserts into `engine_memory`: content, embedding, memory_type, profile_id, workspace_id, created_at
6. Agent confirms: "I'll remember that you need nitrile gloves. I'll make sure to mention this if it comes up in future."

**In a future session (days/weeks later):**

7. Employee or manager asks: "What PPE does Anna need for kitchen shifts?"
8. Agent loads context → Runs vector similarity search on `engine_memory` WHERE profile_id matches Anna
9. Stored memory surfaces: "Employee is allergic to latex gloves, requires nitrile gloves"
10. Agent includes this in response: "Anna needs nitrile gloves instead of standard latex ones due to a latex allergy."

**Postcondition:** Memory persisted in `engine_memory` with vector embedding. Retrievable across sessions via similarity search. Scoped to workspace (RLS enforced).

**Error paths:**

- Memory capability authority set to `disabled` → Agent does not attempt to store memories, information is session-only
- Memory capability authority set to `read_only` → Agent can recall existing memories but cannot store new ones
- Embedding generation fails → Memory stored without embedding (text-only fallback), less effective retrieval
- Duplicate memory detected (high cosine similarity to existing) → System updates existing memory instead of creating duplicate
- `engine_memory` RLS prevents cross-workspace access → Agent in workspace A cannot retrieve memories from workspace B, even for same user

---

## Journey: Manager Reviews Agent Activity

**Precondition:** Manager is logged in, has manager or admin role, employees in their workspace have had conversations with Mr. Botsson.

1. Manager navigates to agent activity view (via dashboard or `/dashboard/ai/` section)
2. System queries `engine_sessions` WHERE workspace_id matches, ordered by last_active DESC
3. System displays session list: employee name, session start time, mode (agent/mission), message count, last active timestamp
4. Manager clicks on a session → System loads session detail
5. Session detail shows:
   - Full conversation transcript (user messages + agent responses)
   - Intent classifications per turn (which capability was invoked)
   - Authority level applied (autonomous / confirm / suggest)
   - Actions taken (e.g., "Looked up closing procedure", "Stored memory about glove preference")
   - Duration and message count
6. Manager filters sessions by date range → System updates list
7. Manager filters by capability (e.g., "Show only Operations conversations") → System filters
8. Manager sees a session where agent said "I'm not set up to help with payroll" → Understands Payroll is disabled
9. Manager reports this to admin → Admin can enable Payroll at `/dashboard/ai/config`

**Postcondition:** Manager has visibility into all agent interactions in their workspace. Can identify patterns, gaps in capability config, and employee needs.

**Error paths:**

- No sessions exist → Empty state: "No agent conversations yet. Employees can start chatting with Mr. Botsson from their dashboard."
- Manager tries to view sessions from another workspace → RLS blocks access, no data returned
- Session data very large (long conversation) → Paginated loading, transcript loads in chunks
- Employee role tries to access activity view → Route guard blocks, only manager/admin/owner can see all sessions
- Employee can see their OWN session history → Filtered to their profile_id only
