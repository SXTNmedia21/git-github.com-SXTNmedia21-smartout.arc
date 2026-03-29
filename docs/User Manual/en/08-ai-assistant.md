---
title: "Lise AI Assistant"
id: MANUAL_08_EN
version: "1.0"
status: canonical
layer: manual
created: 2026-03-24
updated: 2026-03-24
author: claude
slug_en: ai-assistant
tags:
  - manual
  - ai
  - lise
  - voice
  - english
---

# Lise AI Assistant

> 8 AI engines, authorisation levels, voice interface and event log — meet Lise, your operative co-worker.

---

## What is Lise?

Lise is SmartOut's AI assistant. She is designed as an operative co-worker — not just a chatbot. Lise understands your workplace, knows the rules, and can help with everything from shift planning to HACCP questions.

> Lise is not a general AI. She is trained on SmartOut's domain and only has access to data you are authorised to see.

---

## 8 AI engines

Lise is powered by eight specialised engines that work together:

| Engine            | Function                                                            |
| ----------------- | ------------------------------------------------------------------- |
| **Context**       | Understands who you are, your role, and what is happening right now |
| **Knowledge**     | Searches policies, protocols and training materials                 |
| **Journey**       | Guides trainees through onboarding modules step by step             |
| **Payroll**       | Answers questions about pay, supplements and working hours          |
| **Communication** | Helps compose messages, announcements and notifications             |
| **Operations**    | Gives an overview of ongoing sessions, tasks and deviations         |
| **Training**      | Explains procedures and helps with knowledge tests                  |
| **Business**      | Analyses KPIs, trends and gives recommendations                     |

---

## Authorisation levels

Lise respects SmartOut's role model. What she can do depends on your role:

| Role         | Lise can                                                                           |
| ------------ | ---------------------------------------------------------------------------------- |
| **Employee** | Answer questions about your own shift schedule, tasks and training                 |
| **Manager**  | All above + show team reports, suggest shift changes, help with deviation handling |
| **Admin**    | All above + give insight into workspace KPIs, suggest configuration changes        |
| **Owner**    | All above + business analysis, subscription information                            |

> Lise can never see data you don't have access to. The authorisation check happens in real time.

---

## Interface

### Chat

Lise is available as a chat in the dashboard. You can ask questions in Norwegian (or English) and get answers in real time.

**Example questions:**

- "Who is working tomorrow?"
- "Show me the HACCP log for today"
- "Explain the procedure for opening the kitchen"
- "What is the readiness score for the new employees?"

### Voice

Lise supports voice interface via Ultravox. You can speak to her directly from the dashboard — useful in busy situations where you cannot type.

> The voice interface uses real-time speech-to-text and text-to-speech for natural conversation.

---

## Event log

All interactions with Lise are logged in an event log:

- **Questions and answers** — What was asked, and what Lise answered
- **Actions** — What Lise did (e.g. changed the shift schedule, sent a notification)
- **Error reporting** — If Lise gave incorrect information, it can be reported

> The event log is available to administrators and is used to improve Lise over time.

---

## Limitations

- Lise **cannot** make decisions that require the manager's approval without explicit confirmation
- Lise **does not** have access to personal data beyond what is relevant to the request
- Lise **logs** all actions for transparency and audit
