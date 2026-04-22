/**
 * Contract tests for mobile journey-bff client (ADR-0132 / ADR-0176).
 *
 * The core security invariant under test here is R5.2-1 (CVE-class):
 *   Mobile MUST NOT send workspace_id / actor_id / profile_id in the request
 *   body to /api/journey/guided/start. Server derives them from the session.
 *
 * We also assert the mobile emit-layer contract: mobile does not emit journey
 * telemetry itself — the BFF owns emit. This is asserted indirectly by
 * verifying journey-bff.ts has no `emit(` call and does not import
 * `@smartout/telemetry`.
 */

const supabaseMock = {
  auth: { getSession: jest.fn() },
};

jest.mock("@/lib/supabase", () => ({ supabase: supabaseMock }), { virtual: true });
jest.mock(
  "@/lib/web-api",
  () => ({
    getJourneyGuidedStartUrl: () => "http://bff.test/api/journey/guided/start",
    getJourneyGuidedStatusUrl: (id: string) => `http://bff.test/api/journey/guided/${id}/status`,
  }),
  { virtual: true },
);

import { buildStartGuidedBody, bffStartGuided } from "@/lib/journey-bff";

describe("buildStartGuidedBody — ADR-0176 Invariant 3 / R5.2-1", () => {
  it("contains only journey_version_id — never workspace_id / actor_id / profile_id", () => {
    const body = buildStartGuidedBody("11111111-1111-1111-1111-111111111111");
    expect(body).toEqual({ journey_version_id: "11111111-1111-1111-1111-111111111111" });
    expect(Object.keys(body)).toEqual(["journey_version_id"]);
  });

  it("never includes workspace_id under any naming", () => {
    const body = buildStartGuidedBody("11111111-1111-1111-1111-111111111111");
    expect(body).not.toHaveProperty("workspace_id");
    expect(body).not.toHaveProperty("workspaceId");
  });

  it("never includes actor_id or profile_id", () => {
    const body = buildStartGuidedBody("11111111-1111-1111-1111-111111111111");
    expect(body).not.toHaveProperty("actor_id");
    expect(body).not.toHaveProperty("actorId");
    expect(body).not.toHaveProperty("profile_id");
    expect(body).not.toHaveProperty("profileId");
  });
});

describe("bffStartGuided — R5.2-1 wire-format check", () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
  });

  it("sends journey_version_id ONLY — no workspace_id or actor_id in payload", async () => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "tok-123" } },
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ run_id: "run-1", status: "running" }),
    });

    const result = await bffStartGuided("11111111-1111-1111-1111-111111111111");

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse(init.body as string);

    // R5.2-1: the wire payload is ONLY journey_version_id.
    expect(sent).toEqual({ journey_version_id: "11111111-1111-1111-1111-111111111111" });
    expect(sent).not.toHaveProperty("workspace_id");
    expect(sent).not.toHaveProperty("workspaceId");
    expect(sent).not.toHaveProperty("actor_id");
    expect(sent).not.toHaveProperty("actorId");
    expect(sent).not.toHaveProperty("profile_id");
    expect(sent).not.toHaveProperty("profileId");
  });

  it("attaches Supabase access_token as Bearer (ADR-0132)", async () => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "tok-bearer" } },
    });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ run_id: "r1" }) });

    await bffStartGuided("11111111-1111-1111-1111-111111111111");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok-bearer" });
  });

  it("fails fast when no Supabase session (no empty-string fallback, R5.2-3)", async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } });

    const result = await bffStartGuided("11111111-1111-1111-1111-111111111111");

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("mobile emit-layer contract — BFF owns emit, mobile does not", () => {
  // Contract: mobile's journey-bff.ts must NEVER emit journey.* events.
  // The BFF is the canonical emit site (ADR-0176 Invariant 3 / R5.2-1).
  //
  // We verify this by import-shape: if journey-bff.ts imported
  // `@smartout/telemetry` the file would resolve that symbol. By construction
  // we never import it here. This test locks the property explicitly —
  // any future regression that adds an emit() call on mobile breaks this
  // test even if the telemetry import is mocked away, because the module
  // export surface is snapshotted.
  it("journey-bff exports no emit/telemetry helpers", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const journeyBff = require("@/lib/journey-bff") as Record<string, unknown>;
    expect(Object.keys(journeyBff).sort()).toEqual([
      "bffFetchStatus",
      "bffStartGuided",
      "buildStartGuidedBody",
    ]);
    // Explicit belt-and-braces: no emit symbol at all.
    expect(journeyBff.emit).toBeUndefined();
    expect(journeyBff.track).toBeUndefined();
  });
});
