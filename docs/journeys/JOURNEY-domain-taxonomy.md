---
title: User Journeys — Hospitality Domain Taxonomy
status: done
updated: 2026-04-20
created: 2026-04-20
module: helpdesk-channel
tags: [helpdesk, taxonomy, phase-2, classifier, k1a]
---

# User Journeys — Hospitality Domain Taxonomy

> Scope: the taxonomy itself (Phase 2 prereq 3). These journeys describe how the taxonomy will be consumed once the Phase 2 classifier ships — the classifier code is out of scope for this sub-sortie.

## Journey: Phase 2 Classifier — Route Employee Question to Helpdesk Channel

**Precondition:** Workspace is `industry = 'hospitality'`. Employee opens Botsson chat, types a free-text question. At least one channel in the workspace has `helpdesk_enabled = true`.

1. Employee types "Jeg har ikke fått kveldstillegg på lønnsslippen" → Botsson receives message
2. Botsson loads workspace industry package → System resolves `hospitalityPackage.domains`
3. Botsson classifier prompt includes the full domain list (id, label, description, keywords) as candidate routes → System asks LLM to pick the best domain + confidence score
4. LLM returns `{ domain: "payroll", confidence: 0.94 }` → System reads `domain.default_voice_allowed = false`
5. System looks up channels tagged with `payroll` domain (channel-level tagging is Phase 2 proper) → picks responsible rep's helpdesk channel
6. System creates a `channel_event` + `engine_state` (ticket) anchored on that channel → reply posted to employee
7. If Botsson is running in a voice channel → System blocks voice reply for `payroll`/`hr_personal`/`hms_safety`/`other` and escalates to text per ADR-0078/ADR-0163

**Postcondition:** Question is logged on the correct helpdesk channel with the correct responsible rep. Voice policy honored.

**Error paths:**
- **No domain match above threshold (confidence < 0.6):** classifier returns `other` → routed to a general-desk fallback channel, surfaced with "I'm not sure which desk this belongs to — can you clarify?" clarifying question (Phase 2 proper).
- **Non-hospitality workspace:** `domains` is empty array on `defaultPackage` → classifier skips domain filtering and uses capability-level routing only.
- **Voice channel + voice-forbidden domain:** classifier surfaces domain match but refuses to reply on voice; instead nudges "Dette spørsmålet må tas på tekst — jeg kan ikke snakke om lønn på voice."

## Journey: Admin — Tag Helpdesk Channel with Domain(s)

**Precondition:** Admin has `helpdesk_enabled = true` on a channel and wants Botsson to route matching questions there. (Channel-level domain tagging UI is Phase 2 proper — this journey describes the *intent* the taxonomy enables.)

1. Admin opens channel settings for `#bar` → System shows "Helpdesk domains" section
2. Section lists all `HOSPITALITY_DOMAINS` as checkboxes with `label` + `description` (from `packages/ai/src/industry/packages/hospitality.ts`) → Admin reads "Bar og alkohol — Drinkoppskrifter, vinliste, alkoholpolicy og bar-utstyr."
3. Admin checks `bar_operations` + `service_standards` → System persists to channel config (storage model TBD in Phase 2 proper, likely `channel_ai_policy` or a sibling table)
4. Botsson classifier now considers `#bar` a candidate for any question matching those two domains
5. Admin reviews the voice-policy badge on each selected domain ("Voice tillatt" / "Voice blokkert") → System surfaces `default_voice_allowed` per domain so admin understands the effective voice policy without reading the ADR

**Postcondition:** `#bar` is registered as the bar-operations + service-standards desk. Future employee questions about drinks/service on voice or text route here.

**Error paths:**
- **Admin selects `payroll` on a public-mode channel:** System warns "Lønn er PII — denne kanalen er public. Vurder privat-modus eller egen lønn-desk." (soft warning, does not block — privacy mode is admin decision, Phase 2 proper handles the guard.)
- **Admin selects `hms_safety` and wants voice:** System surfaces the default-voice-forbidden flag → Admin must explicitly override `channel_ai_policy.voice_participation` to unblock. Taxonomy default stays conservative; per-channel override is the escape hatch.

## Journey: Fallback — Employee Asks a Question That Matches No Domain

**Precondition:** Classifier runs domain routing and none of the ten specific domains score above threshold.

1. Employee types "Hvor er førstehjelpsskrinet?" → Botsson runs classifier
2. LLM scores all domains; `hms_safety` gets 0.55, `equipment` gets 0.50, `other` gets 0.40 → no domain above 0.6 threshold
3. Classifier returns `{ domain: "other", confidence: 0.40 }` → System reads `domain.default_voice_allowed = false`
4. Botsson posts clarifying question: "Handler dette om HMS/sikkerhet eller utstyr? Velg en så finner jeg riktig kanal." (Phase 2 proper)
5. Employee picks "HMS" → Botsson re-runs routing with hinted domain = `hms_safety`

**Postcondition:** `other` is never silently routed to a real desk — it always triggers a clarifying question. This keeps the fallback from masking a misconfigured taxonomy.

**Error paths:**
- **Employee declines to clarify / closes chat:** question lands in a workspace-level "general questions" inbox (Phase 2 proper behavior, out of scope for this sub-sortie).
- **No clarification UI yet (Phase 2 proper not shipped):** in the interim, `other` bypasses classification entirely and posts the question to the primary helpdesk channel. This is acceptable because Phase 2 listener is itself a prereq — if the listener is not wired, nothing calls this code path.

## Consumption contract — what Phase 2 proper relies on

| Contract | Source | Guarantees |
|----------|--------|------------|
| `HOSPITALITY_DOMAINS` exported from `@smartout/ai` industry package | `packages/ai/src/industry/packages/hospitality.ts` | Stable IDs; new domains added only in additive ADRs |
| `Domain` type exported from `@smartout/types` | `packages/types/src/industry.ts` | 5-field shape unchanged without new ADR |
| `default_voice_allowed` semantics | ADR-0078, ADR-0163 | Voice-forbidden = classifier refuses voice reply unless admin override |
| `other` always present | test: `contains the canonical 'other' fallback bucket` | Classifier can always produce a valid domain verdict |
| Non-hospitality packages expose `domains: []` | test: `default package exposes an empty domains array` | Classifier safely handles workspaces outside hospitality vertical |
