import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveConsent,
  HANDBOOK_DOCUMENT_VERSION,
  GDPR_DOCUMENT_VERSION,
  TARIFF_DOCUMENT_VERSION,
} from "../welcome-wizard-actions";

// Mock resolveCurrentProfile from _shared (the actual import source).
const resolveCurrentProfileMock = vi.fn();
vi.mock("../_shared", () => ({
  resolveCurrentProfile: (...args: unknown[]) => resolveCurrentProfileMock(...args),
}));

// Mock createAdminClient — consent_acceptance has no JWT INSERT policy so
// saveConsent uses the admin (service-role) client for all operations.
const adminMock = { schema: vi.fn(), from: vi.fn() };
vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: () => adminMock,
}));

// Mock telemetry — emit is fire-and-forget; nonEmpty passthrough for test clarity.
vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn(async () => undefined),
  nonEmpty: (s: string | null | undefined) => s as string,
}));

// Default happy-path profile.
const defaultProfile = {
  profileId: "p-1",
  workspaceId: "w-1",
  role: "employee",
};

// Build a chainable payroll.workspace_settings mock that resolves maybeSingle.
function buildPayrollSchemaMock(is_tariff_bound: boolean) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { is_tariff_bound } });
  const eqFn = vi.fn().mockReturnValue({ maybeSingle });
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
  const fromFn = vi.fn().mockReturnValue({ select: selectFn });
  return { schema: vi.fn().mockReturnValue({ from: fromFn }) };
}

describe("saveConsent", () => {
  beforeEach(() => {
    adminMock.schema.mockReset();
    adminMock.from.mockReset();
    resolveCurrentProfileMock.mockReset();
    resolveCurrentProfileMock.mockResolvedValue(defaultProfile);
  });

  it("rejects missing handbook (schema guard)", async () => {
    const r = await saveConsent({ handbook: false as never, gdpr: true });
    expect(r.ok).toBe(false);
  });

  it("rejects missing gdpr (schema guard)", async () => {
    const r = await saveConsent({ handbook: true, gdpr: false as never });
    expect(r.ok).toBe(false);
  });

  it("rejects when tariff required but not accepted", async () => {
    // Workspace is tariff-bound.
    const schemaMock = buildPayrollSchemaMock(true);
    adminMock.schema.mockImplementation(schemaMock.schema);

    const r = await saveConsent({ handbook: true, gdpr: true });
    expect(r).toEqual({ ok: false, error: "tariff_consent_required" });
  });

  it("inserts 2 rows when tariff not bound", async () => {
    const schemaMock = buildPayrollSchemaMock(false);
    adminMock.schema.mockImplementation(schemaMock.schema);

    const insert = vi.fn().mockResolvedValue({ error: null });
    adminMock.from.mockReturnValue({ insert });

    const r = await saveConsent({ handbook: true, gdpr: true });
    expect(r.ok).toBe(true);

    expect(insert).toHaveBeenCalledOnce();
    const rows = (insert.mock.calls[0]?.[0] ?? []) as Array<{
      consent_type: string;
      document_version: string;
    }>;
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          consent_type: "handbook",
          document_version: HANDBOOK_DOCUMENT_VERSION,
        }),
        expect.objectContaining({
          consent_type: "gdpr",
          document_version: GDPR_DOCUMENT_VERSION,
        }),
      ]),
    );
  });

  it("inserts 3 rows when tariff bound + accepted", async () => {
    const schemaMock = buildPayrollSchemaMock(true);
    adminMock.schema.mockImplementation(schemaMock.schema);

    const insert = vi.fn().mockResolvedValue({ error: null });
    adminMock.from.mockReturnValue({ insert });

    const r = await saveConsent({ handbook: true, gdpr: true, tariff: true });
    expect(r.ok).toBe(true);

    const rows = (insert.mock.calls[0]?.[0] ?? []) as Array<{
      consent_type: string;
      document_version: string;
    }>;
    expect(rows).toHaveLength(3);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ consent_type: "handbook" }),
        expect.objectContaining({ consent_type: "gdpr" }),
        expect.objectContaining({
          consent_type: "tariff",
          document_version: TARIFF_DOCUMENT_VERSION,
        }),
      ]),
    );
  });

  it("propagates insert error", async () => {
    const schemaMock = buildPayrollSchemaMock(false);
    adminMock.schema.mockImplementation(schemaMock.schema);

    adminMock.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { message: "db error" } }),
    });

    const r = await saveConsent({ handbook: true, gdpr: true });
    expect(r).toEqual({ ok: false, error: "db error" });
  });

  it("uses server-derived profile_id and workspace_id (never caller-supplied)", async () => {
    const schemaMock = buildPayrollSchemaMock(false);
    adminMock.schema.mockImplementation(schemaMock.schema);

    const insert = vi.fn().mockResolvedValue({ error: null });
    adminMock.from.mockReturnValue({ insert });

    await saveConsent({ handbook: true, gdpr: true });

    const rows = (insert.mock.calls[0]?.[0] ?? []) as Array<{
      profile_id: string;
      workspace_id: string;
    }>;
    for (const row of rows) {
      expect(row.profile_id).toBe(defaultProfile.profileId);
      expect(row.workspace_id).toBe(defaultProfile.workspaceId);
    }
  });
});
