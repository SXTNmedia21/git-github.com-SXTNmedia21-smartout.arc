// apps/web/src/lib/storage/__tests__/botsson-imports.test.ts
import { describe, it, expect } from "vitest";
import { validateAttachmentMime, ATTACHMENT_MIME_ALLOWLIST } from "../botsson-imports";

describe("validateAttachmentMime", () => {
  it("accepts xlsx MIME", () => {
    expect(
      validateAttachmentMime("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ).toBe(true);
  });

  it("accepts csv MIME", () => {
    expect(validateAttachmentMime("text/csv")).toBe(true);
  });

  it("rejects pdf MIME", () => {
    expect(validateAttachmentMime("application/pdf")).toBe(false);
  });

  it("rejects empty/undefined", () => {
    expect(validateAttachmentMime("")).toBe(false);
    expect(validateAttachmentMime(undefined as unknown as string)).toBe(false);
  });
});
