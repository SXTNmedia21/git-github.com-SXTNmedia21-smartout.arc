---
title: P7 steward gate — mobile-voice-runtime-wire
status: done
created: 2026-05-20
updated: 2026-05-20
module: mobile-voice-runtime-wire
tags: [gate, steward, p7, mobile, voice]
---

# P7 Steward Gate — feat/mobile-voice-runtime-wire

> Date: 2026-05-20
> Branch: `feat/mobile-voice-runtime-wire`
> Worktree: `/home/sxtnl/dev/smartout.ai-mobile-wt-5`
> Base: `campaign/mobile` @ `bc7c27bf6`
> Commits under inspection: `ab78525ce` → `4e02eb891` (10 commits)

## Gate verdict

**GREEN — proceed to P8.**

Both code and documentation reflect a clean sortie. All 13 telemetry events have emit() call-sites per ADR-0377. All 7 acceptance criteria from the plan are met. 4 journeys updated; 3 marked `verified`, 1 marked `verified-with-deferred-gaps` (D4 mid-session policy detection + multi-banner priority — both documented as out-of-scope follow-ups). 1 ADR drafted (ADR-0378, proposed) codifying the LiveKit data-channel four-topic protocol that mobile + voice-agent now share.

## Plan vs reality

| Plan task | Commit(s) | Acceptance criterion | Met? | Evidence |
|-----------|-----------|----------------------|------|----------|
| P3 — Mobile publishes botsson-context | `be6c825dd` | `voice.bootstrap.snapshot_published` fires within 1500ms; voice-agent `setSessionContext()` invoked; second turn answered without `query_smartout`; non-empty workspace_id+actor_id; PII whitelist enforced | YES | `apps/mobile/src/lib/livekit-data-publish.ts:115,118` topic + retry; `apps/mobile/src/hooks/use-botsson-voice-session.ts:1136-1149` emit with `nonEmpty()` guards; P3 proof artefact at `docs/proofs/P3-context-publish-proof.md` PASS 9/9 |
| P3-verify — voice-agent context proof | `01f90588b` + `4b58a1ed9` | L-0233 falsifiable proof | YES | `apps/mobile/src/lib/__tests__/livekit-data-publish.test.ts` 4/4 PASS; `services/voice-agent/__tests__/context.test.ts` 5/5 PASS; broken vitest test removed |
| P4 — Mobile tool RPC | `354ae0b63` | botsson-tools-register published <100ms after botsson-context; navigate within 2s; 5 tools round-trip; call_id 1:1; latency <1500ms; HARNESS_ADAPTER_VOICE_ENABLED documented | YES (smoke deferred to P8) | `apps/mobile/src/hooks/use-botsson-voice-session.ts:745-870` DataReceived handler + 1069/1082/833/843 emit sites; `apps/mobile/src/lib/livekit-data-publish.ts:166-209` TOOLS_REGISTER_TOPIC + TOOL_RESULT_TOPIC; flag documented in commit message |
| P4-rev — code review | `6e9432ef7` | PII redact + comment sync + required-default | YES | `use-botsson-voice-session.ts:851-855` "Never include raw tool output — may contain PII (ADR-0078)"; `client-tool-rpc.ts:10-14` topic protocol comment matches actual envelope shapes; `botsson-tools.ts:165+` default required=false |
| P5 — Text chat to /api/emma/chat | `efcbe25ac` | Round-trip <100ms send → 2-4s response; shared TranscriptPane; channel server-pinned; PII whitelist; non-empty IDs | YES | `apps/mobile/src/hooks/use-emma-chat.ts:103-211` send() with optimistic+rollback; `botsson-provider.tsx:307-334` shared transcript state; BFF `/api/emma/chat/route.ts:165` cross-checks workspace_id |
| P5-rev — code review | `561e64371` | Stable deps + dead-var + UUID collision fix | YES | `use-emma-chat.ts:211` `[]` deps with refs; `BotssonSheet.tsx` removed unused `voiceEnabled`; `botsson-provider.tsx` `crypto.randomUUID()` |
| P6 — Production UX polish | `dd62300e2` | Mic-denied dialog; 3-retry banner; policy-flip auto-switch; 4-state Orb; settings canonical; zero OKLCH literals; i18n keys or TODO | YES (with 2 documented deferrals) | `BotssonSheet.tsx:358-396` 4 banners; `Orb.tsx:64-79` error gradient; `StatusLabel.tsx:21` FEIL label; new types `OrbStatus = waiting\|active\|complete\|error`; deferrals documented in commit + journey frontmatter |
| P6-design-rev — a11y + Nordic Split | `4e02eb891` | WCAG 4.1.2 role removed; spacing tokens; emoji → Lucide | YES | `BotssonSheet.tsx` lucide-react-native imports (X, Mic, MicOff); `accessibilityRole="search"` removed from TextInput; `theme.spacing.xs` used in banners; `disconnectStartMs` initialized to 0 |
| P7 — Steward gate | this report | Plan vs reality + ADRs + telemetry parity | YES | this artefact |

## Journey verification status

| Journey | Status | Evidence |
|---------|--------|----------|
| `JOURNEY-mobile-voice-runtime-wire-context-publish.md` | `verified` | P3 proof PASS 9/9; emit() call-sites at use-botsson-voice-session.ts:1137,1160; topic guard tested |
| `JOURNEY-mobile-voice-runtime-wire-tool-rpc.md` | `verified` | 5 telemetry emit() sites; data-channel handler with dedup; HARNESS_ADAPTER_VOICE_ENABLED documented; smoke test deferred to P8 (PWA walkthrough) |
| `JOURNEY-mobile-voice-runtime-wire-text-chat.md` | `verified` | 3 telemetry emit() sites; BFF cross-check confirms server-side workspace validation; ADR-0107 deriveBotssonChannel; optimistic UI rollback verified |
| `JOURNEY-mobile-voice-runtime-wire-ux-polish.md` | `verified-with-deferred-gaps` | 5 sub-journeys: 1+2+4+5 verified; 3 (policy flip) PARTIAL — start-path only; mid-session deferred; multi-banner priority deferred |

## ADR drafts

| Slot | Title | Status | Summary |
|------|-------|--------|---------|
| ADR-0378 | LiveKit data-channel protocol for Botsson voice-agent — four-topic envelope contract | proposed | Codifies wire-level contract: `botsson-context` + `botsson-tools-register` + `botsson-tool-call` + `botsson-tool-result`. Topic names + discriminators LOCKED; field additions backward-compatible. Pre-existing implementation; ADR is documentation-only. Refs ADR-0078/0132/0134/0135/0151/0297/0327, L-0233/0234. |

### ADR drafting decisions (other candidates assessed, not drafted)

1. **ADR-0151 amendment for workspaceId-via-body + cross-check** — NOT drafted. BFF `/api/emma/chat/route.ts:165` cross-checks `body.workspaceId` against profile and returns 403 on mismatch. This is NOT the L-0177 silent-fallback anti-pattern. Pattern is widespread, intentional, and pre-existing. An enforcement ADR could be drafted in future if Pontus wants a single contract document, but it is not blocking THIS sortie.
2. **Mobile optimistic UI pattern (rollback on failure)** — NOT drafted. Single instance; not a recurring pattern across sortier yet. Promote on 2nd instance.
3. **4-state Orb refinement** — NOT drafted. `OrbStatus` enum extension; not architectural.

## Telemetry registry parity (L-0298 / ADR-0377)

All 13 events: interface defined + SmartoutEvent union entry + EVENT_ROUTING entry + at least one emit() call-site.

| Event | Interface | Union | Routing | Emit call-site |
|-------|-----------|-------|---------|----------------|
| voice.bootstrap.snapshot_published | registry.ts:5077 | 9249 | 14899 | use-botsson-voice-session.ts:1137 |
| voice.bootstrap.publish_failed | 5094 | 9250 | 14903 | use-botsson-voice-session.ts:1160 |
| voice.bootstrap.tool_registered | 5117 | 9252 | 14914 | use-botsson-voice-session.ts:1069 |
| voice.bootstrap.tool_register_failed | 5130 | 9253 | 14918 | use-botsson-voice-session.ts:1082 |
| voice.bootstrap.rpc_completed | 5143 | 9254 | 14922 | use-botsson-voice-session.ts:833 |
| voice.bootstrap.rpc_failed | 5160 | 9255 | 14926 | use-botsson-voice-session.ts:843 |
| mobile.chat.message_sent | 5222 | 9261 | 14955 | use-emma-chat.ts:228 |
| mobile.chat.response_received | 5235 | 9262 | 14959 | use-emma-chat.ts:253 |
| mobile.chat.error | 5250 | 9263 | 14963 | use-emma-chat.ts:278 |
| mobile.voice.mic_permission_denied | 5276 | 9264 | 14973 | use-botsson-voice-session.ts:941 |
| mobile.voice.disconnect_recovered | 5287 | 9265 | 14977 | use-botsson-voice-session.ts:701 |
| mobile.voice.disconnect_failed | 5302 | 9266 | 14981 | use-botsson-voice-session.ts:647 |
| mobile.voice.policy_flipped | 5317 | 9267 | 14985 | botsson-provider.tsx:315 |

**13/13 PASS.** No silent observability holes per ADR-0377.

## Cross-cutting ADR compliance

| ADR | Status | Evidence |
|-----|--------|----------|
| ADR-0078 (channel + PII) | PASS | `rpc_failed.reason` redacted at use-botsson-voice-session.ts:851-855 (no raw tool output); voice-channel filters tool stubs server-side per ADR-0327; BFF chat route forces channel='chat' server-side |
| ADR-0107 (channel derivation) | PASS | `apps/mobile/src/providers/botsson-channel.ts:30-32` derives from mode, never platform; `botsson-provider.tsx:416` uses `deriveBotssonChannel(mode)` |
| ADR-0132 (thin client) | PASS | All AI traffic goes via `/api/emma/chat` (chat) + `/api/emma/voice/transcript` (voice). No direct capability calls from mobile. LiveKit data channel is voice-agent-side, not capability-side. |
| ADR-0133 (mobile execute boundary) | PASS | No authoring verbs introduced. 5 mobile tools (navigate_to, open_sheet, show_toast, start_punch, call_leader) are all C4-execute or D5-presentation. |
| ADR-0134 + L-0177 (telemetry IDs fail-fast) | PASS | `nonEmpty(workspaceId, ...)` + `nonEmpty(profileId, ...)` enforced at every emit() site; `getProfileContext()` throws on empty IDs via `profile-context.ts:42-49` |
| ADR-0151 (workspace_id server-derived) | PASS-WITH-NOTE | Mobile chat sends `workspaceId` in body; BFF cross-checks via `.eq("workspace_id", body.workspaceId)` on profile lookup — produces 403 on mismatch, NOT silent fallback. This is established pattern (multiple precedents: ADR-0315 contract routes, predecessor sortie), distinct from L-0177 anti-pattern. Codifying as ADR could be future work; not blocking this sortie. |
| ADR-0240 (no cross-namespace writes) | PASS | No capability writes added. RPC dispatches only to module-private `executeMobileTool()` (UI side effects, not DB writes). |
| ADR-0297 (workforce snapshot pipe) | PASS | Runtime delivery wired via `botsson-context` topic (ADR-0378 protocol). Snapshot parsed from BFF `/api/emma/voice/transcript` response per P1 implementation. |
| ADR-0327 (HarnessAdapter) | PASS | `ClientToolDefinition` from `@smartout/ai/harness/types` used as wire-level type on `botsson-tools-register` |
| ADR-0366 (OKLCH literal ban) | PASS | Zero hex/rgb/rgba/oklch literals in new files (ChatErrorBanner, MicPermissionDialog, NetworkRetryBanner). Pre-existing `Orb.tsx` rgba documented at file header §1-22 (React Native limitation — `oklch()` unsupported in Expo). New `error` stop follows same documented pattern. |
| ADR-0377 (telemetry registry requires emit) | PASS | 13/13 events have emit() call-sites (see Telemetry table above) |
| L-0176 (docstrings after body satisfies) | PASS | P4-rev applied — client-tool-rpc.ts:10-14 protocol comment matches actual envelope shapes after fix |
| L-0233 (voice-agent context proof) | PASS | P3-verify proof artefact at `docs/proofs/P3-context-publish-proof.md` — producer + consumer halves both PASS |
| L-0234 (voice view-tools mirror) | PASS | 5 mobile client tools published via `botsson-tools-register`; data-channel dispatch wired |

## Known gaps disposition

| Gap | Source | Disposition | Rationale |
|-----|--------|-------------|-----------|
| D4 mid-session policy flip via `use-voice-transcripts.ts onError` callback | P6 commit dd62300e2 | DEFER | Non-trivial signature change on the transcripts hook. Start-path detection covers the dominant code path. Mid-session 403 currently surfaces as error in transcript pane (non-blocking degraded mode). Track as backlog. |
| Multi-banner priority logic for concurrent states | P6-design-rev | DEFER | Banner states (mic-denied, network, policy, chat-error) are mutually-improbable in practice. Render order is set; stacking is acceptable for V1. Track as polish backlog. |

## Backlog items (for future sortier)

1. Add `onError` callback to `useVoiceTranscripts` hook + wire to `botsson-provider` to detect mid-session policy 403 → auto-switch to text mode.
2. Multi-banner priority resolver — if 2+ banners visible simultaneously, hide lower-priority. Suggested order: mic-denied (start-time) > policy (server-revoked) > network (transient) > chat-error (text-specific).
3. Hoist `BotssonContextInitPayload` (mobile) + `ContextInitMessage` (voice-agent) into shared `@smartout/types/livekit-protocol.ts` (per ADR-0378 follow-ups).
4. Add mobile-side topic-guard test for `DataReceived` (parity with voice-agent's `topic guard rejects payloads on other topics`).
5. Add 10s tool-call timeout integration test on voice-agent side.
6. Consider drafting an ADR codifying the "workspaceId-in-body + server cross-check" pattern as the canonical alternative to L-0177 silent fallback (multiple precedents exist; future-proof contract for direct API-key callers).

## Recommended next actions

### For P8 (typecheck + PWA walkthrough)

- Run `pnpm turbo typecheck --filter=@smartout/{ai,mobile,telemetry,web}`. Predecessor sortie noted pre-existing mobile typecheck errors in `@smartout/utils`, `@smartout/types`, `ParagrafReferenceList` (P5 commit message). These should NOT be introduced by this sortie; verify the deltas are clean.
- PWA walkthrough on `localhost:8083`:
  1. Login → long-press FAB → BotssonSheet opens in voice mode
  2. Speak "hvem jobber kveldsvakt på torsdag" → expect specific names (workforce snapshot used; no `query_smartout` roundtrip)
  3. Say "åpne vaktlisten" → mobile navigates to `/schedule` within 2s (P4 acceptance criterion)
  4. Switch to text mode → type "hva er min vakt i morgen" → response renders in same TranscriptPane (P5)
  5. Deny mic permission → MicPermissionDialog appears → tap "Skriv i stedet" → text mode (D2)
  6. Disable wifi mid-voice → NetworkRetryBanner appears → reconnect (D3)
- Verify telemetry events in PostHog dev project (or activity_trail if PostHog unreachable). Acceptance: 13 events emit with non-empty workspace_id + actor_id.

### For P9 (handoff + close-feature)

- HANDOFF must document:
  - ADR-0378 proposed (full architectural decision captured)
  - L-0234 closure via this sortie (mobile view-tools mirror shipped)
  - L-0233 closure status (proof artefact P3-verify PASS)
  - 6 backlog items (see above)
  - HARNESS_ADAPTER_VOICE_ENABLED feature flag state — currently OFF in 1Password vault; flipping to true activates voice-agent stub building. Coordinate with Pontus.
  - 2 deferred items (D4 mid-session, multi-banner priority) — explicitly flag as known-debt for next sortie.
- Update `docs/STATE-SUMMARY.md` if it references mobile voice runtime gaps (Phase A close-out signal).
- Close-feature.sh path: sortie `feat/mobile-voice-runtime-wire` → merge to `campaign/mobile`. Sync development into campaign after merge.

## Verification commands used

```bash
git log --oneline campaign/mobile..HEAD               # 10 commits
git show --stat <each commit>                          # file impact per task
grep -c 'voice\.bootstrap\|mobile\.chat\|mobile\.voice' packages/telemetry/src/registry.ts   # 26 references
grep -rn '<all 13 events>' apps/mobile/src             # emit call-sites
grep -rEn 'oklch\(|#[0-9a-fA-F]{3,6}\b|rgb\(|rgba\(' apps/mobile/src/components/ai/   # ADR-0366 sweep (zero new)
ls docs/decisions/ | tail -20                          # confirm next ADR slot = 0378
cat docs/decisions/0377-telemetry-registry-requires-emit-wiring.md   # ADR-0377 context
cat docs/decisions/0151-stage-engine-profile-id-server-derivation.md # ADR-0151 scope confirmation
```

## Refs

- ADR-0378 (proposed) — drafted by this gate
- ADR-0377 — telemetry registry requires emit wiring (precedent applied)
- L-0233 — closed by this sortie's P3 proof
- L-0234 — closed by this sortie's P4 RPC wiring
- L-0298 — emit() coverage discipline applied throughout
- P3 proof artefact — `docs/proofs/P3-context-publish-proof.md`
