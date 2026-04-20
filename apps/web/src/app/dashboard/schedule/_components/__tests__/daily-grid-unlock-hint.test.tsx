/**
 * Integration test for the shift-gate unlock hint flowing out of the schedule
 * daily grid. Verifies that:
 *   1. Pending protocols from the readinessMap render a hint under the row.
 *   2. The hint's training link uses the real `protocol_id` (UUID), not the
 *      protocol name — guarding against the bug that closed PR #194.
 *   3. `steps_remaining` from the hook is rendered, not the old `1` placeholder.
 *   4. When the step count is 0 but a test/confirmation is pending, the hint
 *      falls back to "test gjenstår" / "signering gjenstår".
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ShiftUnlockHint, type MissingProtocol } from "../ShiftUnlockHint";

const PROTOCOL_UUID = "4c8a3c5e-1234-4abc-9def-0123456789ab";

describe("daily-grid shift-gate unlock hint", () => {
  it("renders hint under an employee row with pending protocols", () => {
    const missing: MissingProtocol[] = [
      {
        protocol_id: PROTOCOL_UUID,
        name: "HACCP",
        steps_remaining: 4,
        test_pending: false,
        confirmation_pending: false,
      },
    ];

    const html = renderToStaticMarkup(<ShiftUnlockHint missingProtocols={missing} />);

    expect(html).toContain('data-testid="shift-unlock-hint"');
    expect(html).toContain("HACCP");
    expect(html).toContain("4 steg igjen");
  });

  it("links to /dashboard/my-training/{UUID}, not the protocol name", () => {
    const missing: MissingProtocol[] = [
      {
        protocol_id: PROTOCOL_UUID,
        name: "HACCP",
        steps_remaining: 2,
        test_pending: false,
        confirmation_pending: false,
      },
    ];

    const html = renderToStaticMarkup(<ShiftUnlockHint missingProtocols={missing} />);

    expect(html).toContain(`href="/dashboard/my-training/${PROTOCOL_UUID}"`);
    expect(html).not.toContain('href="/dashboard/my-training/HACCP"');
  });

  it("falls back to 'test gjenstår' when steps are zero but a test is pending", () => {
    const missing: MissingProtocol[] = [
      {
        protocol_id: PROTOCOL_UUID,
        name: "Kassarutine",
        steps_remaining: 0,
        test_pending: true,
        confirmation_pending: false,
      },
    ];

    const html = renderToStaticMarkup(<ShiftUnlockHint missingProtocols={missing} />);

    expect(html).toContain("test gjenstår");
    expect(html).not.toContain("0 steg igjen");
  });

  it("falls back to 'signering gjenstår' when only a confirmation is pending", () => {
    const missing: MissingProtocol[] = [
      {
        protocol_id: PROTOCOL_UUID,
        name: "Taushetsplikt",
        steps_remaining: 0,
        test_pending: false,
        confirmation_pending: true,
      },
    ];

    const html = renderToStaticMarkup(<ShiftUnlockHint missingProtocols={missing} />);

    expect(html).toContain("signering gjenstår");
  });

  it("renders nothing when there are no pending protocols", () => {
    const html = renderToStaticMarkup(<ShiftUnlockHint missingProtocols={[]} />);
    expect(html).toBe("");
  });
});
