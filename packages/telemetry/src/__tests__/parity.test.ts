/**
 * Engine Event Parity Contract (ADR-0180) — TDD test
 *
 * Why this exists:
 *   Several Edge Functions direct-insert into `activity_trail` for telemetry
 *   (because Deno-runtime functions cannot import the @smartout/telemetry
 *   `emit()` path that auto-routes per registry). When the registry says an
 *   event must also write `engine_event`, the Edge Function MUST mirror that
 *   insert manually. Per ADR-0180, divergence between registry routing and
 *   Edge-Function writes is a contract violation.
 *
 * RED state expectation (Wave H Task 9):
 *   Test 2 currently fails for any Edge Function whose direct activity_trail
 *   insert is not paired with an engine_event insert for the SAME event_type
 *   when the registry mandates engine_event routing. The fix lands in
 *   subsequent Wave H tasks (e.g. H.2 Task 15 deletes create-invitation
 *   entirely, replacing it with same-origin proxy + emit() path).
 *
 * Convention bridge:
 *   - activity_trail.event uses space-separated names ("invitation created")
 *   - engine_event.event_type uses dot-separated names ("invitation.created")
 *   - registry uses space-separated keys
 *   The test normalizes Edge-Function dot-strings back to spaces for lookup.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { EVENT_ROUTING } from "../registry";

const REPO_ROOT = join(__dirname, "../../../..");
const EDGE_FUNCTIONS_DIR = join(REPO_ROOT, "supabase/functions");

function findEdgeFunctionFiles(dir: string): string[] {
  const result: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      // Skip _shared, .git, hidden dirs
      if (entry.startsWith("_") || entry.startsWith(".")) continue;
      result.push(...findEdgeFunctionFiles(path));
    } else if (entry === "index.ts") {
      result.push(path);
    }
  }
  return result;
}

describe("Engine Event Parity Contract (ADR-0180)", () => {
  it("registry contains events with dual activity_trail+engine_event routing", () => {
    const dualRouted = Object.entries(EVENT_ROUTING).filter(
      ([, routing]) =>
        routing.destinations.includes("activity_trail") &&
        routing.destinations.includes("engine_event"),
    );
    expect(dualRouted.length).toBeGreaterThan(0);
  });

  it("Edge Function direct-insert sites that write activity_trail also write engine_event for the same event_type", () => {
    const files = findEdgeFunctionFiles(EDGE_FUNCTIONS_DIR);
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, "utf-8");

      // activity_trail direct inserts use `event:` key (registry convention,
      // space-separated). Match across newlines via [\s\S].
      const activityMatches = [
        ...content.matchAll(
          /from\(["']activity_trail["']\)\.insert\(\s*\{[\s\S]*?event:\s*["']([^"']+)["']/g,
        ),
      ];
      // engine_event inserts use `event_type:` key (engine convention,
      // dot-separated). Same multi-line tolerance.
      const engineMatches = [
        ...content.matchAll(
          /from\(["']engine_event["']\)\.insert\(\s*\{[\s\S]*?event_type:\s*["']([^"']+)["']/g,
        ),
      ];

      const activityEvents = new Set(activityMatches.map((m) => m[1]));
      // Normalize engine_event dot-form to space-form for matching against
      // activity_trail event names ("invitation.created" -> "invitation created").
      const engineEventsNormalized = new Set(engineMatches.map((m) => m[1].replace(/\./g, " ")));

      for (const eventName of activityEvents) {
        const routing = EVENT_ROUTING[eventName as keyof typeof EVENT_ROUTING];
        // Unregistered events: separate L-0083 concern, not a parity failure.
        if (!routing) continue;
        // If registry doesn't require engine_event for this event, skip.
        if (!routing.destinations.includes("engine_event")) continue;

        if (!engineEventsNormalized.has(eventName)) {
          const rel = file.replace(REPO_ROOT + "/", "");
          violations.push(
            `${rel}: writes activity_trail "${eventName}" but missing engine_event row (registry mandates dual-route per ADR-0180)`,
          );
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(`Engine_event parity violations (per ADR-0180):\n${violations.join("\n")}`);
    }
  });
});
