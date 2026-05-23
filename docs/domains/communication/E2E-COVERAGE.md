---
title: "Communication Domain — E2E Coverage"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: communication
tags: [domain, communication, e2e, playwright, testing]
---

# Communication Domain — E2E Coverage

> Test matrix. "Verified" means the test file exists and has a test for the scenario.
> Source: `apps/e2e/` directory verified 2026-05-23.

---

## E2E test files

| File | What it covers |
|---|---|
| `apps/e2e/tests/communication-harness-e2e.spec.ts` | Communication harness integration (helper adapter) |
| `apps/e2e/tests/harness-adapter-chat-client-tool.spec.ts` | ChatClient tool adapter (capability tool integration) |
| `apps/e2e/tests/domain-chat-ownership/komm-chat-passive.spec.ts` | Komm chat in passive mode (DomainChatOwnership — ADR-0238) |
| `apps/e2e/tests/domain-chat-ownership/komm-thread-passive.spec.ts` | Komm thread in passive mode |
| `apps/e2e/tests/sortie-p0-fix-sweep-shift-chat-banner.spec.ts` | Shift chat banner smoke test |
| `apps/e2e/komm-nyheter/` | Announcements (Nyheter) E2E (exact test files: see folder) |

Helper: `apps/e2e/helpers/communication-harness.ts`

---

## Coverage matrix

| Scenario | Covered? | Test file | Notes |
|---|---|---|---|
| Open Komm, see channel list | 🔴 | — | No channel list E2E |
| Send text message in a channel | 🔴 | — | No message send E2E |
| Receive Realtime message update | 🔴 | — | Realtime hard to test in Playwright |
| Create custom channel | 🔴 | — | No creation flow E2E |
| Auto-create department channel on dept INSERT | 🔴 | — | Trigger, no E2E |
| Komm chat passive mode (domain ownership) | ✅ | `komm-chat-passive.spec.ts` | ADR-0238 compliance |
| Komm thread passive mode | ✅ | `komm-thread-passive.spec.ts` | ADR-0238 compliance |
| Announcement publish (Nyheter) | 🟡 | `apps/e2e/komm-nyheter/` | Partial — exact test coverage TBD |
| ChatClient tool adapter | ✅ | `harness-adapter-chat-client-tool.spec.ts` | Harness integration |
| Shift chat banner | ✅ | `sortie-p0-fix-sweep-shift-chat-banner.spec.ts` | Smoke only |
| Voice call start | 🔴 | — | LiveKit requires real WebRTC; no E2E |
| PTT flow | 🔴 | — | |
| Helpdesk query creation | 🔴 | — | Capability not implemented |
| Targeted note fanout | 🔴 | — | No E2E for cron-based fanout |
| Botsson mention in channel | 🔴 | — | channel_ai_policy unwired |

---

## Coverage gaps

| Gap ID | Scenario | Priority |
|---|---|---|
| EG1 | Channel list render + unread badge | HIGH — core UI, no coverage |
| EG2 | Send + receive message (Realtime roundtrip) | HIGH — core flow |
| EG3 | Auto-create session channel on session INSERT | MEDIUM — trigger behaviour |
| EG4 | Custom channel creation by admin | MEDIUM |
| EG5 | Helpdesk query lifecycle (open → assigned → resolved) | HIGH — blocked on G4 |
| EG6 | Targeted note fanout (cron + delivery) | MEDIUM — cron is hard; at least test API layer |
| EG7 | Voice call join/leave | LOW — WebRTC complexity |

---

## Manual test coverage (documented flows)

No `MANUAL-TEST-communication.md` file exists yet. Required before feature completion per project closure standards.

**Minimum manual test scenarios:**
1. Employee opens Komm on mobile — channel list visible, unread counts correct
2. Manager sends announcement — appears in nyheter + channel as `announcement` message type
3. Session channel created when session opens — duty leader added, correct channel_type
4. Direct message between two employees
5. Admin enables helpdesk on a channel — `helpdesk_enabled` flag set, representative role visible
