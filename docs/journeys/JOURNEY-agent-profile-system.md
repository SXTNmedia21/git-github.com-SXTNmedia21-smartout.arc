---
title: "User Journeys — Agent Profile System"
status: done
updated: 2026-03-10
created: 2026-03-10
module: ai
tags: [agent, voice, personality, posture, relationship, journeys]
---

# User Journeys — Agent Profile System

---

## Journey: Employee — First Conversation with Mr. Botsson

**Precondition:** Employee is active in a workspace. Workspace has agent_profile (auto-created at activation).

1. Employee opens agent chat → System calls `routeAgentMessage()` with message, profileId, workspaceId
2. System classifies intent → determines capability + confidence
3. System calls `collectContext()` → parallel fetch: profile, agent_profile, relationship (none exists), memories, active shift
4. No relationship found → System auto-creates `agent_relationship` row with zeroed scores
5. System resolves posture: base personality + role adjustment + situation + zero-relationship boost (more formal, more verbose)
6. System builds prompt: "Dette er første gang du snakker med {name}. Introduser deg og vær ekstra hjelpsom."
7. LLM generates warm, introductory response → Employee sees greeting

**Postcondition:** agent_relationship row exists for this employee. Conversation count = 0 (updated after session ends).

**Error paths:**

- Missing agent_profile → Falls back to default Mr. Botsson personality (hardcoded defaults)
- Profile fetch fails → Uses fallback name "Ansatt", role "employee"

---

## Journey: Employee — Returning Conversation (High Familiarity)

**Precondition:** Employee has had 20+ conversations. Familiarity score > 0.6.

1. Employee sends message → System routes through agent pipeline
2. Context collector fetches relationship: familiarityScore=0.78, totalConversations=24
3. Posture resolver detects high familiarity → adjusts: formality -0.1, humor +0.1, verbosity -0.05
4. Prompt includes: "Du kjenner {name} godt (24 samtaler). Samtalene har vært positive."
5. LLM responds with more casual, concise tone
6. After session ends → `updateRelationshipAfterSession()` increments count to 25, recalculates familiarity

**Postcondition:** Familiarity score updated (logarithmic growth). Composite relationship score recalculated.

---

## Journey: Employee — HACCP Situation

**Precondition:** Employee asks about food safety / HACCP protocol.

1. Employee: "Hva er temperaturkravene for kjøleskap?" → Intent classified as capability: "training", situation auto-resolved to "haccp"
2. Posture resolver applies HACCP adjustment: assertiveness +0.2, warmth -0.1, humor -0.2
3. Mr. Botsson responds in a more direct, serious, no-humor tone
4. Tools selected based on authority config for "training" capability
5. If authority = "autonomous" → additional assertiveness +0.1

**Postcondition:** Response tone matches the seriousness of food safety context.

**Error paths:**

- Wrong situation classification → Falls back to "general" posture (neutral, professional)

---

## Journey: Admin — Workspace Activation Creates Agent Profile

**Precondition:** Admin completes onboarding. Workspace about to be activated.

1. Admin clicks "Aktiver arbeidssted" → `activate-workspace` Edge Function fires
2. Edge Function creates workspace → immediately inserts `agent_profile` row with defaults
3. Default profile: display_name="Mr. Botsson", language="no", voice="mark", balanced personality
4. Insert is non-fatal — workspace activation succeeds even if profile creation fails

**Postcondition:** Workspace has agent_profile row. All employees can interact with Mr. Botsson immediately.

---

## Journey: Admin — Agent Profile Customization (Future UI)

**Precondition:** Agent profile exists for workspace. Admin navigates to AI settings.

1. Admin opens `/dashboard/ai/config` → sees personality sliders and voice settings
2. Admin adjusts warmth from 0.7 to 0.9, humor from 0.2 to 0.4 → saves
3. System updates `agent_profile` row
4. Next employee conversation → context collector fetches updated personality → posture resolver uses new baseline

**Postcondition:** All future conversations use the new personality baseline.

**Note:** UI for this journey exists at `/dashboard/ai/config` (authority config). Personality slider UI is planned but not yet built.

---

## Journey: System — Relationship Update After Session

**Precondition:** Agent session has ended. Session duration and sentiment are known.

1. Session ends → `updateRelationshipAfterSession(workspaceId, profileId, minutes, sentiment)` called
2. System increments `total_conversations`, adds to `total_minutes`
3. Familiarity recalculated: `log10(conversations + 1) / log10(50)` (caps at 1.0)
4. Sentiment counts updated (positive/neutral/negative tallied)
5. Sentiment score: `(positive + neutral*0.5) / total`
6. Composite: `0.3 * familiarity + 0.4 * trust + 0.3 * sentiment`
7. Row updated with new scores

**Postcondition:** Relationship metrics reflect the latest interaction. Next conversation uses updated scores.

**Error paths:**

- No agent_profile for workspace → silently returns (no update)
- No relationship row → silently returns (should have been created during session)
