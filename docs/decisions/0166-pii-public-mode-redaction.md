---
title: "PII redaction in public-mode helpdesk channels — soft-hold classifier"
id: ADR_0166
status: accepted
layer: decision
created: 2026-04-20
updated: 2026-04-20
amends: ADR-0163
---

# ADR-0166: PII redaction in public-mode helpdesk channels — soft-hold classifier before publish

## Context and Problem Statement

ADR-0165 introduces `channel.privacy_mode='public'` helpdesk channels — rooms where helpdesk questions are visible to all channel members. This creates a new exposure vector absent in Phase 1's private-only helpdesk model: an employee posting personnummer, bank-konto, eller andre ID-data in a public room like #bar, where 7+ colleagues can read it before any admin reacts.

The Progressive Channel council (2026-04-20) surfaced three options:

- **a. Hard block at send-time.** Classifier detects PII → capability-tool refuses to publish → clarifying message sent to user. Prevents exposure entirely but also prevents legitimate edge-case posts (e.g. a last-four-digits reference).
- **b. Post-then-flag.** Message publishes → classifier flags → activity_trail logs → admin notified. Observability-first. But PII is visible to all members for the roundtrip time before admin reacts.
- **c. Silent post.** No classifier intervention. Responsibility on employee.

Steward recommended **a** on CVE-class grounds (L-0066 through L-0071). Pontus chose **b**. This ADR formalizes b with the soft-hold mitigation to close the exposure window.

## Decision Drivers

- Product posture: observability over prevention — admins want to see what employees are actually asking, and false-positive blocks erode trust more than occasional PII flags.
- ADR-0163 (PII `allowedChannels` mandatory) already restricts helpdesk_query capability to `chat` channel. This ADR does not weaken ADR-0163; it adds an additional pre-publish gate for text content inside allowed channels.
- Classifier latency budget: <800ms to not feel like a block to the user. Realistic for on-device or fast-path cloud classifier on a single message.
- Audit trail requirement: every PII detection must be logged to `activity_trail` regardless of outcome (redacted, allowed, escalated). Compliance need.

## Considered Options

1. **Option a (preempt-and-block):** As Steward recommended. Rejected per product decision.
2. **Option b raw (post-then-flag):** As offered. Rejected — exposure window unacceptable for personnummer.
3. **Option b with soft-hold (this ADR):** Classifier runs before publish with bounded latency; on PII detection, original message is stored in audit-log + private channel, public timeline sees redacted version.
4. **Option c (silent post):** Rejected on compliance grounds.

## Decision Outcome

Chosen: **Option b with soft-hold classifier.**

### Rules

1. **Soft-hold window:** Incoming `channel_message.insert` on a channel with `helpdesk_enabled=true` AND `privacy_mode='public'` triggers a synchronous PII classifier call with a **800ms timeout**. Message is NOT yet visible to other members. User sees their own message locally (optimistic UI) while classification runs.

2. **Classifier timeout fallback:** If classifier does not respond within 800ms, message publishes as-is with `pii_classifier_status='timeout'` written to `channel_message.classification_metadata`. Admin notified via background task. Fail-open on latency is acceptable because it mirrors network failure paths; the alternative (fail-closed blocking) creates trust-eroding freezes on transient classifier slowness.

3. **PII detected (hit above threshold):**
   - Original message content copied to audit-log (`activity_trail` entry with event `helpdesk.pii.detected`).
   - A NEW private sub-channel (`channel_type='query_thread'`, parent = the public helpdesk channel, members = message author + channel's responsible rep) is spawned via the existing `openPrivateTicket` Server Action path.
   - Original public-channel message is rewritten to a redaction placeholder: *"[PII redigert — {author} har fått privat sak hos {responsible_rep}]"*, author unchanged, `redacted_at` timestamp set.
   - `channel_message.original_content_hash` stored (for later unredaction audits), never the plaintext.
   - Admin receives push notification with link to the private sub-channel.

4. **Clarifying message to author:** Sender receives an inline system message in the redacted thread: *"Meldingen din inneholdt sensitive data. Jeg har flyttet den til en privat kanal med {responsible_rep} slik at bare dere to ser den."* Botsson-avsender, not the rep's voice.

5. **No hard block:** Send itself never fails from the user's perspective. The redaction + sub-channel creation are transparent. If the user's intent was to ask publicly about something trivially mis-classified (e.g. a last-four-digits reference), they can re-send with context; the redaction is logged but reversible via admin action.

6. **Voice PII (ADR-0078 preserved):** This ADR applies to TEXT messages only. Voice is already forbidden for PII handling per ADR-0078 + ADR-0163. Voice transcription in a `privacy_mode='public'` channel is not a covered path because `voice_participation='disabled'` is enforced when privacy_mode is set.

7. **Classifier source:** Phase 1A ships a simple regex/rules-based classifier (Norwegian personnummer format, NOR-IBAN, phone formats) with a pluggable interface. Phase 2+ may replace with LLM-based classifier. Classifier lives at `packages/ai/src/classifiers/pii-classifier.ts` (new package path).

8. **Activity trail events:**
   - `helpdesk.pii.detected` — always emits on classifier hit. Properties: `original_content_hash`, `pii_categories[]`, `classifier_version`, `confidence`, `redaction_outcome`.
   - `helpdesk.pii.classifier_timeout` — emits on >800ms timeout. Properties: `classifier_version`, `duration_ms`.
   - `helpdesk.pii.false_positive_reported` — emits when admin marks a detection as incorrect (Phase 2 admin UI).

## What is explicitly rejected

- **Blocking send (Option a).** Product decision; documented here for future councils so the trade-off is visible.
- **No classifier at all (Option c).** Compliance requirement makes silent-post unacceptable for public helpdesk.
- **LLM classifier in Phase 1A.** Latency budget (800ms) and cost envelope do not support LLM for every public-channel message. Regex rules are sufficient for the high-value cases (personnummer, bank, phone).
- **Reversible redaction by admin.** Phase 2+ question. Phase 1A redactions are one-way. Admin action to "undo" would require the plaintext to be retrievable, which reintroduces the exposure surface. Deferred.

## Consequences

### Positive

- CVE-class exposure window closed. PII never reaches public timeline visible state.
- Observability preserved (admin sees every detection). Product posture maintained.
- No false-positive blocks frustrating users — only redactions, which are visible and re-sendable.
- Establishes classifier pattern reusable for other sensitive-data domains (schedule info, compensation, medical).

### Negative / trade-offs

- 800ms soft-hold is perceived latency by the sender. Mitigation: optimistic UI shows message locally immediately; redaction swap happens in place without scroll jump.
- Classifier false-negatives (missed PII) still possible. Acceptance criterion: publish accuracy metrics monthly; triple-9 false-negative rate on personnummer format required before scaling classifier rules.
- Redaction placeholder in timeline may puzzle other members. Mitigated by consistent wording and channel-level helper tooltip ("hvorfor vises ikke meldingen?").

## Implementation plan

Phase 1A.2 ships:
- `packages/ai/src/classifiers/pii-classifier.ts` (regex rules for Norwegian PII)
- DB columns: `channel_message.classification_metadata jsonb`, `channel_message.redacted_at timestamptz`, `channel_message.original_content_hash text`
- Hook: `on-message-insert-pii-guard` trigger calling classifier before RLS-visible state flips
- Activity trail event registration
- Admin UI: PII-detection log viewer in workspace admin (simple list, filter by user/date)

Not in Phase 1A:
- Reversible redaction (Phase 2+)
- LLM-based classifier (Phase 2+)
- Per-channel classifier policy overrides (Phase 3+)

## References

- ADR-0163 (amended — adds soft-hold for text PII in public helpdesk on top of allowedChannels restriction)
- ADR-0078 (channel restriction — preserved for voice)
- ADR-0165 (Progressive Channel Discriminator — motivates public-mode helpdesk)
- L-0066–L-0071 (prior helpdesk council CVE-class findings — context for why hard-block was originally recommended)
- Council session 2026-04-20 Progressive Channel — Q1 product decision captured in `docs/council/COUNCIL-LOG.md`
