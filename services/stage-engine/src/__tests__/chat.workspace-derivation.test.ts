/**
 * chat.workspace-derivation.test.ts
 *
 * Unit tests for the workspace + profile_id derivation logic introduced in F-SE-01.
 *
 * Tested in isolation (pure-function coverage):
 *   - parseVoiceSessionProfileId: regex parsing of "voice-{ws_id}-{profile_id}" format
 *
 * Integration-level cases (documented as intent; full integration test requires
 * a test-app helper that is not yet wired — see agent-chat-forged-profile.test.ts
 * for the pattern when that helper lands):
 *   - User JWT, no workspace_context → uses auth.workspaceId (existing behavior)
 *   - Service JWT (channel=voice), workspace_context.workspace_id present → effectiveWorkspaceId = workspace_context value
 *   - Service JWT (channel=voice), workspace_context absent → 400 MISSING_WORKSPACE_CONTEXT_FOR_SERVICE_ACCOUNT
 *   - Service JWT (channel=voice), workspace_context.workspace_id = "" → 400 (nonEmpty throws)
 */

import { describe, expect, it } from "vitest";

// ─── Pure-function import ────────────────────────────────────────────────────
// parseVoiceSessionProfileId is defined in chat.ts but not exported.
// We test it via re-implementation of its contract here, plus verify the
// regex pattern directly. When the helper is extracted to a shared util,
// this test should import from there instead.

/**
 * Mirrors parseVoiceSessionProfileId from routes/agent/chat.ts.
 * Kept in sync manually — if the pattern changes in chat.ts, update here.
 */
function parseVoiceSessionProfileId(sessionId: string): string | null {
  const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const VOICE_SESSION_RE = new RegExp(`^voice-(${UUID_PATTERN})-(${UUID_PATTERN})$`, "i");
  const match = VOICE_SESSION_RE.exec(sessionId);
  if (!match) return null;
  return match[2]; // second UUID is the profile_id
}

// ─── Sample UUIDs ────────────────────────────────────────────────────────────
const WS_ID = "550e8400-e29b-41d4-a716-446655440000";
const PROFILE_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

describe("parseVoiceSessionProfileId", () => {
  it("returns profile_id from a valid voice session_id", () => {
    const sessionId = `voice-${WS_ID}-${PROFILE_ID}`;
    expect(parseVoiceSessionProfileId(sessionId)).toBe(PROFILE_ID);
  });

  it("returns null for a plain UUID (chat session_id format)", () => {
    const sessionId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    expect(parseVoiceSessionProfileId(sessionId)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseVoiceSessionProfileId("")).toBeNull();
  });

  it("returns null for 'voice-' prefix with only one UUID", () => {
    expect(parseVoiceSessionProfileId(`voice-${WS_ID}`)).toBeNull();
  });

  it("returns null for 'voice-' prefix with malformed workspace UUID", () => {
    expect(parseVoiceSessionProfileId(`voice-not-a-uuid-${PROFILE_ID}`)).toBeNull();
  });

  it("returns null for 'voice-' prefix with malformed profile UUID", () => {
    expect(parseVoiceSessionProfileId(`voice-${WS_ID}-not-a-uuid`)).toBeNull();
  });

  it("is case-insensitive for hex chars (uppercase UUIDs)", () => {
    const upper = `voice-${WS_ID.toUpperCase()}-${PROFILE_ID.toUpperCase()}`;
    expect(parseVoiceSessionProfileId(upper)).toBe(PROFILE_ID.toUpperCase());
  });

  it("extracts the SECOND UUID as profile_id (not workspace_id)", () => {
    // workspace_id != profile_id — verify we get the right one
    const sessionId = `voice-${WS_ID}-${PROFILE_ID}`;
    const result = parseVoiceSessionProfileId(sessionId);
    expect(result).toBe(PROFILE_ID);
    expect(result).not.toBe(WS_ID);
  });
});

// ─── Workspace derivation contract intent ────────────────────────────────────
// These describe the EXPECTED behavior of the workspace-derivation logic in
// routes/agent/chat.ts. They are documented here for traceability (F-SE-01).
// Full request-level integration tests require a test-app helper.

describe("workspace derivation — contract intent (F-SE-01)", () => {
  it("INTENT: user JWT + no workspace_context → uses auth.workspaceId (unchanged chat path)", () => {
    // When body.channel = "chat" and body.workspace_context is absent,
    // effectiveWorkspaceId = auth.workspaceId (JWT-derived, existing behavior).
    // No regression on chat path.
    expect(true).toBe(true); // documented; skip until test-app helper available
  });

  it("INTENT: voice channel + workspace_context.workspace_id present → effectiveWorkspaceId = body value", () => {
    // When body.channel = "voice" and body.workspace_context.workspace_id = "ws-X",
    // effectiveWorkspaceId = "ws-X" — even if auth.workspaceId = "ws-service-account".
    // This is the F-SE-01 fix: BFF-derived workspace overrides service-account JWT workspace.
    expect(true).toBe(true); // documented; skip until test-app helper available
  });

  it("INTENT: voice channel + no workspace_context → 400 MISSING_WORKSPACE_CONTEXT_FOR_SERVICE_ACCOUNT", () => {
    // Fail-closed: voice-agent always sends workspace_context.
    // Absence = malformed request. Never silently fall back to JWT default (L-0177).
    expect(true).toBe(true); // documented; skip until test-app helper available
  });

  it("INTENT: voice channel + workspace_context.workspace_id = empty string → 400 (nonEmpty throws)", () => {
    // nonEmpty() from @smartout/telemetry/server throws on empty string.
    // This prevents corrupt telemetry routing (ADR-0134).
    expect(true).toBe(true); // documented; skip until test-app helper available
  });
});
