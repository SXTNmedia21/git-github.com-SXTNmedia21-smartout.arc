// packages/ai/src/router/__tests__/attachment-dispatch.test.ts
import { describe, it, expect } from "vitest";
import { resolveCapabilityFromAttachments } from "../attachment-dispatch";

describe("resolveCapabilityFromAttachments", () => {
  it("returns null for empty attachments", () => {
    expect(resolveCapabilityFromAttachments([])).toBeNull();
    expect(resolveCapabilityFromAttachments(undefined)).toBeNull();
  });

  it("returns bulk_import for xlsx MIME", () => {
    const result = resolveCapabilityFromAttachments([
      {
        storage_path: "ws/file.xlsx",
        signed_url: "https://example.com/x",
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size_bytes: 1024,
        filename: "vaktliste.xlsx",
        expires_at: new Date().toISOString(),
      },
    ]);
    expect(result).toEqual({
      capability: "bulk_import",
      source: "deterministic_attachment",
      filename: "vaktliste.xlsx",
    });
  });

  it("returns bulk_import for csv MIME", () => {
    const result = resolveCapabilityFromAttachments([
      {
        storage_path: "ws/file.csv",
        signed_url: "https://example.com/x",
        mime: "text/csv",
        size_bytes: 100,
        filename: "shifts.csv",
        expires_at: new Date().toISOString(),
      },
    ]);
    expect(result?.capability).toBe("bulk_import");
  });

  it("returns null for unknown MIME (no deterministic match)", () => {
    const result = resolveCapabilityFromAttachments([
      {
        storage_path: "ws/file.pdf",
        signed_url: "https://example.com/x",
        mime: "application/pdf",
        size_bytes: 100,
        filename: "x.pdf",
        expires_at: new Date().toISOString(),
      },
    ]);
    expect(result).toBeNull();
  });

  it("first-match-wins on multiple attachments", () => {
    const result = resolveCapabilityFromAttachments([
      {
        storage_path: "ws/a.csv",
        signed_url: "x",
        mime: "text/csv",
        size_bytes: 1,
        filename: "a.csv",
        expires_at: new Date().toISOString(),
      },
      {
        storage_path: "ws/b.pdf",
        signed_url: "x",
        mime: "application/pdf",
        size_bytes: 1,
        filename: "b.pdf",
        expires_at: new Date().toISOString(),
      },
    ]);
    expect(result?.capability).toBe("bulk_import");
    expect(result?.filename).toBe("a.csv");
  });
});
