import { describe, it, expect } from "vitest";
import {
  BubbleApiError,
  BubbleAuthError,
  BubbleNotFoundError,
  BubbleRateLimitError,
  bubbleErrorFromResponse,
} from "../../src/bubble/errors.js";

describe("bubble errors", () => {
  it("401 becomes BubbleAuthError", () => {
    const err = bubbleErrorFromResponse(401, { error: "invalid token" });
    expect(err).toBeInstanceOf(BubbleAuthError);
    expect(err.message).toContain("invalid token");
  });

  it("404 becomes BubbleNotFoundError", () => {
    const err = bubbleErrorFromResponse(404, { error: "type not found" });
    expect(err).toBeInstanceOf(BubbleNotFoundError);
  });

  it("429 becomes BubbleRateLimitError", () => {
    const err = bubbleErrorFromResponse(429, { error: "slow down" });
    expect(err).toBeInstanceOf(BubbleRateLimitError);
  });

  it("500 becomes generic BubbleApiError", () => {
    const err = bubbleErrorFromResponse(500, { error: "internal" });
    expect(err).toBeInstanceOf(BubbleApiError);
    expect(err).not.toBeInstanceOf(BubbleAuthError);
    expect(err.statusCode).toBe(500);
  });

  it("handles body without error field", () => {
    const err = bubbleErrorFromResponse(500, null);
    expect(err).toBeInstanceOf(BubbleApiError);
    expect(err.message).toContain("500");
  });
});
