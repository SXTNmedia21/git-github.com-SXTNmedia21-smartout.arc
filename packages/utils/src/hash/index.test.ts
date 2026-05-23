// packages/utils/src/hash/index.test.ts
import { describe, expect, it } from "vitest";
import { sha256Hex } from "./index.js";

describe("sha256Hex", () => {
  it("returns canonical empty-string hex digest", () => {
    expect(sha256Hex(Buffer.from(""))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it('returns canonical "abc" hex digest', () => {
    expect(sha256Hex(Buffer.from("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("accepts Uint8Array input", () => {
    expect(sha256Hex(new Uint8Array([97, 98, 99]))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
