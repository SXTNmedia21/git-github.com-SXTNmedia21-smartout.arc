/**
 * JourneyIR v2 schema tests (ADR-0178).
 *
 * Scope:
 *   - v1 IRs (`version: "1.0.0"`) parse unchanged — additive guarantee.
 *   - v2 IRs (`version: "2.0.0"`) accept `actor`, `platform`, `auth_profile`,
 *     `preconditions`, and `JourneyStep.actions` as optional additions.
 *   - `JourneyActionSchema` validates the 7-variant discriminated union.
 *   - `assertCurrentIrVersion()` accepts v2 writes, rejects v1 writes.
 *
 * What this file does NOT test:
 *   - Runtime Fjernkontroll state — owned by ADR-0177 at the runtime layer.
 */

import { describe, it, expect } from "vitest";

import {
  JourneyIRSchema,
  JourneyActionSchema,
  JourneyPreconditionsSchema,
  JourneyStepSchema,
} from "./schema";
import type { JourneyIR, JourneyStep } from "./types";
import { CURRENT_IR_VERSION } from "./types";
import { assertCurrentIrVersion, UnsupportedIrVersionError } from "./compile";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MINIMAL_V1_STEP: JourneyStep = {
  key: "1_start",
  title: "Start",
  action: "Open the page",
  assertion: "URL matches pattern: /start",
};

const MINIMAL_V1_IR: JourneyIR = {
  version: "1.0.0",
  slug: "test-journey",
  title: "Test Journey",
  module: "test",
  steps: [MINIMAL_V1_STEP],
};

// ---------------------------------------------------------------------------
// v1 additive-compat guarantee
// ---------------------------------------------------------------------------

describe("JourneyIR v1 additive-compat", () => {
  it("parses a minimal v1 IR unchanged", () => {
    const parsed = JourneyIRSchema.safeParse(MINIMAL_V1_IR);
    expect(parsed.success).toBe(true);
  });

  it("accepts v1 IR without v2 optional fields", () => {
    const parsed = JourneyIRSchema.parse(MINIMAL_V1_IR);
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.actor).toBeUndefined();
    expect(parsed.platform).toBeUndefined();
    expect(parsed.auth_profile).toBeUndefined();
    expect(parsed.preconditions).toBeUndefined();
    expect(parsed.steps[0]!.actions).toBeUndefined();
  });

  it("rejects unknown top-level keys via .strict() (no silent drift)", () => {
    const parsed = JourneyIRSchema.safeParse({
      ...MINIMAL_V1_IR,
      bogus: "oops",
    } as unknown);
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// v2 additive fields on the IR
// ---------------------------------------------------------------------------

describe("JourneyIR v2 additive fields", () => {
  it("accepts a fully-populated v2 IR with all new optional fields", () => {
    const v2: JourneyIR = {
      version: "2.0.0",
      slug: "onboarding",
      title: "Admin Onboarding",
      module: "onboarding",
      actor: "owner",
      platform: "web",
      auth_profile: "admin",
      preconditions: {
        db_state: [{ table: "profile", where: { id: "x" }, expect: { is_active: true } }],
      },
      steps: [
        {
          key: "1_login",
          title: "Log in",
          action: "Fill creds + click submit",
          assertion: "URL matches /dashboard",
          timeoutMs: 15000,
          actions: [
            { type: "navigate", url: "/login" },
            { type: "fill", testid: "login-email", value: "a@b" },
            { type: "fill", testid: "login-password", value: "pw" },
            { type: "click", testid: "login-submit" },
          ],
        },
      ],
    };
    const parsed = JourneyIRSchema.safeParse(v2);
    expect(parsed.success).toBe(true);
  });

  it("accepts a v2 IR with version 2.0.0 but no v2 optional fields", () => {
    const sparseV2: JourneyIR = { ...MINIMAL_V1_IR, version: "2.0.0" };
    const parsed = JourneyIRSchema.safeParse(sparseV2);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid actor enum value", () => {
    const bad = { ...MINIMAL_V1_IR, version: "2.0.0", actor: "ceo" };
    const parsed = JourneyIRSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid platform enum value", () => {
    const bad = { ...MINIMAL_V1_IR, version: "2.0.0", platform: "desktop" };
    const parsed = JourneyIRSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid auth_profile enum value", () => {
    const bad = { ...MINIMAL_V1_IR, version: "2.0.0", auth_profile: "root" };
    const parsed = JourneyIRSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });

  it("accepts empty preconditions object", () => {
    const v2: JourneyIR = {
      ...MINIMAL_V1_IR,
      version: "2.0.0",
      preconditions: {},
    };
    const parsed = JourneyIRSchema.safeParse(v2);
    expect(parsed.success).toBe(true);
  });

  it("accepts preconditions with empty db_state array", () => {
    const v2: JourneyIR = {
      ...MINIMAL_V1_IR,
      version: "2.0.0",
      preconditions: { db_state: [] },
    };
    const parsed = JourneyIRSchema.safeParse(v2);
    expect(parsed.success).toBe(true);
  });

  it("rejects preconditions with bogus top-level keys", () => {
    const bad = {
      ...MINIMAL_V1_IR,
      version: "2.0.0",
      preconditions: { db_state: [], extra: 1 },
    };
    const parsed = JourneyPreconditionsSchema.safeParse({ db_state: [], extra: 1 });
    expect(parsed.success).toBe(false);
    const fullParsed = JourneyIRSchema.safeParse(bad);
    expect(fullParsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// JourneyAction discriminated union
// ---------------------------------------------------------------------------

describe("JourneyAction discriminated union", () => {
  it("accepts navigate", () => {
    expect(JourneyActionSchema.safeParse({ type: "navigate", url: "/x" }).success).toBe(true);
  });

  it("accepts fill", () => {
    expect(JourneyActionSchema.safeParse({ type: "fill", testid: "x", value: "y" }).success).toBe(
      true,
    );
  });

  it("accepts click", () => {
    expect(JourneyActionSchema.safeParse({ type: "click", testid: "x" }).success).toBe(true);
  });

  it("accepts click_text", () => {
    expect(JourneyActionSchema.safeParse({ type: "click_text", text: "ok" }).success).toBe(true);
  });

  it("accepts wait_visible", () => {
    expect(JourneyActionSchema.safeParse({ type: "wait_visible", testid: "x" }).success).toBe(true);
  });

  it("accepts wait_hidden", () => {
    expect(JourneyActionSchema.safeParse({ type: "wait_hidden", testid: "x" }).success).toBe(true);
  });

  it("accepts settle", () => {
    expect(JourneyActionSchema.safeParse({ type: "settle", ms: 1500 }).success).toBe(true);
  });

  it("rejects unknown action type", () => {
    expect(JourneyActionSchema.safeParse({ type: "scroll", amount: 100 }).success).toBe(false);
  });

  it("rejects missing required field (fill without value)", () => {
    expect(JourneyActionSchema.safeParse({ type: "fill", testid: "x" }).success).toBe(false);
  });

  it("rejects extra keys via .strict()", () => {
    expect(JourneyActionSchema.safeParse({ type: "click", testid: "x", bonus: 1 }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// JourneyStep.actions (v2)
// ---------------------------------------------------------------------------

describe("JourneyStep.actions (v2 optional)", () => {
  it("accepts a step with actions", () => {
    const step: JourneyStep = {
      ...MINIMAL_V1_STEP,
      actions: [
        { type: "navigate", url: "/a" },
        { type: "click", testid: "btn" },
      ],
    };
    expect(JourneyStepSchema.safeParse(step).success).toBe(true);
  });

  it("accepts a step without actions (v1 shape)", () => {
    expect(JourneyStepSchema.safeParse(MINIMAL_V1_STEP).success).toBe(true);
  });

  it("rejects actions containing a bogus variant", () => {
    const bad = {
      ...MINIMAL_V1_STEP,
      actions: [{ type: "teleport", to: "moon" }],
    };
    expect(JourneyStepSchema.safeParse(bad).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Version guard — assertCurrentIrVersion
// ---------------------------------------------------------------------------

describe("assertCurrentIrVersion", () => {
  it("accepts the current write version (2.0.0)", () => {
    expect(() => assertCurrentIrVersion({ version: "2.0.0" })).not.toThrow();
  });

  it("rejects legacy version (1.0.0) with UnsupportedIrVersionError", () => {
    expect(() => assertCurrentIrVersion({ version: "1.0.0" })).toThrow(UnsupportedIrVersionError);
  });

  it("attaches received + required versions to the error", () => {
    try {
      assertCurrentIrVersion({ version: "1.0.0" });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(UnsupportedIrVersionError);
      const e = err as UnsupportedIrVersionError;
      expect(e.receivedVersion).toBe("1.0.0");
      expect(e.requiredVersion).toBe("2.0.0");
    }
  });

  it("CURRENT_IR_VERSION is 2.0.0", () => {
    expect(CURRENT_IR_VERSION).toBe("2.0.0");
  });
});

// ---------------------------------------------------------------------------
// v2.1 speed_profile additive field
// ---------------------------------------------------------------------------

describe("JourneyIR speed_profile (additive v2.1)", () => {
  it("accepts ir without speed_profile (default = full)", () => {
    const ir: JourneyIR = {
      version: "2.0.0",
      slug: "test",
      title: "Test",
      module: "test",
      steps: [MINIMAL_V1_STEP],
    };
    expect(JourneyIRSchema.parse(ir).speed_profile).toBeUndefined();
  });

  it("accepts ir with speed_profile=normal", () => {
    const ir: JourneyIR = {
      version: "2.0.0",
      slug: "test",
      title: "Test",
      module: "test",
      steps: [MINIMAL_V1_STEP],
      speed_profile: "normal",
    };
    expect(JourneyIRSchema.parse(ir).speed_profile).toBe("normal");
  });

  it("rejects unknown speed_profile value", () => {
    const ir = {
      version: "2.0.0",
      slug: "test",
      title: "Test",
      module: "test",
      steps: [MINIMAL_V1_STEP],
      speed_profile: "turbo",
    };
    expect(() => JourneyIRSchema.parse(ir)).toThrow();
  });
});
