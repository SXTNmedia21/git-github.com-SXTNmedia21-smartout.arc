# Module 12: AI-Laget — Mr. Botsson

> **Smartout.io** — Functional documentation for migration
> Version 1.0 | February 2026
> **Dependencies:** All modules (AI operates across the entire platform)
> **Status:** PLACEHOLDER — requires detailed specification

---

## 1. Module Overview

8 specialized AI engines that power Mr. Botsson — the AI assistant that operates across every module. Chat-first with voice upgrade. Norwegian language support. Full transparency via AI Event Log.

### What This Module Covers

- Chat interface (text-based AI assistant)
- Voice interface (Ultravox + Twilio)
- Context Engine (user profile, sentiment, mode detection)
- Knowledge Engine (RAG with pgvector)
- Journey Engine (onboarding/offboarding/promotions)
- Payroll Engine (salary calculation assistance)
- Communication Engine (message formatting, channel selection)
- Operation Engine (daily ops, Department Sessions)
- Learning Engine (training content, quiz generation)
- Business Engine (KPIs, strategy, reports)
- AI Governance Assistance (Policy → Protocol suggestions)

---

## 2. Chat Interface

> **TODO:** Detailed specification needed

- Text chat in the app (both mobile and desktop)
- Contextual awareness: who is asking, their role, current session, time of day
- Conversation history per user
- Suggested actions based on context
- Multi-language: responds in user's `preferred_language`

---

## 3. Voice Interface

> **TODO:** Detailed specification needed (existing infrastructure documented in SMARTOUT_V1_REVISED_ARCHITECTURE.md)

- Ultravox integration for AI voice conversations
- Twilio telephony for phone-based access
- Norwegian language support (`languageHint: "no"`)
- Conversation flow and interrupt handling
- Tool calling from voice (workspace setup, task creation, etc.)
- Existing infrastructure: MCP server, BrowserCall component, mission/stage system

---

## 4. Context Engine

> **TODO:** Detailed specification needed

- User profile and context vector
- Behavioral indices: reliability, engagement, progress, loyalty, capacity, risk
- Sentiment tracking over time
- Mode detection: on shift, off duty, training, trainee, break, etc.
- Preference learning

---

## 5. Knowledge Engine

> **TODO:** Detailed specification needed

- RAG with embeddings via pgvector (Supabase)
- Document storage and chunking strategy
- Semantic search over workspace content (policies, procedures, handbooks)
- Role and workspace filtering (never leak cross-workspace data)
- Source tracking and citation

---

## 6. Journey Engine

> **TODO:** Detailed specification needed

- Onboarding: Trainee Mode + Module Journeys
- Checkpoint tracking with AI dynamic guidance
- Offboarding: status transition, data preservation
- Promotions: role changes, new protocol assignments
- Progress monitoring and escalation (48-hour rule)

---

## 7. Payroll Engine

> **TODO:** Detailed specification needed

- Salary calculation from shift data
- Supplement calculation with rule application
- Norwegian labor law validation
- Payroll run assistance and anomaly detection

---

## 8. Communication Engine

> **TODO:** Detailed specification needed

- Message formatting with context and templates
- Channel selection based on preferences and urgency
- Multi-channel delivery: SMS, email, push, voice
- Delivery tracking and retry logic

---

## 9. Operation Engine

> **TODO:** Detailed specification needed

- Daily ops management via Department Sessions
- Day Brief compilation from session notes, handoffs, events
- Proactive alerts and reminders
- Reactive event handling modes: Triage, Monitor, Compile, Predict, Act, Learn
- Goal tracking and suggestions

---

## 10. Learning Engine

> **TODO:** Detailed specification needed

- Create and suggest training content
- Quiz generation and scoring
- Progress tracking per user
- Recommendations based on knowledge gaps
- Skill mapping and development paths

---

## 11. Business Engine

> **TODO:** Detailed specification needed

- KPI tracking and trend analysis
- Financial overview and forecasting
- Legal document assistance
- Strategic planning suggestions
- Report generation

---

## 12. AI Governance Assistance

> **TODO:** Detailed specification needed

When admin writes a Policy, AI helps configure the Protocol — suggesting:

- Procedures based on policy statement and industry
- Routines with appropriate scheduling
- Runbooks for failure scenarios
- Control lists for verification
- Knowledge tests for comprehension
- Best practices from similar workspaces (anonymized)

---

## 13. AI Authority Levels

| Level            | Behavior                 | Example                                |
| ---------------- | ------------------------ | -------------------------------------- |
| `autonomous`     | AI acts without asking   | Create ad-hoc task from note           |
| `notify_suggest` | AI notifies and suggests | "HACCP check overdue — send reminder?" |
| `notify`         | AI only notifies         | "Overtime threshold approaching"       |
| `escalate`       | AI escalates to human    | "Deviation requires manager review"    |
| `never`          | AI does not participate  | Manual-only operations                 |

Configurable per workspace, per action type.

---

## 14. AI Event Log

All AI operations logged with full transparency:

- What the AI decided
- What authority level was used
- What data was considered
- What action was taken or suggested
- Reviewable by admin

---

_This module requires detailed specification across all 8 engines. The existing voice infrastructure (MCP server, Ultravox, BrowserCall) provides a significant head start. See SMARTOUT_V1_REVISED_ARCHITECTURE.md for voice implementation details._
