// PlaceholderAdapter + registry contract tests (ADR-0129).
//
// Locked-in behaviours:
//   - PlaceholderAdapter.sync() MUST return { status: 'mocked' } —
//     NEVER 'succeeded'. That distinction is the whole audit gate.
//   - PlaceholderAdapter.testConnection() MUST return
//     { status: 'ok', is_placeholder: true } so the UI can render the
//     dedicated placeholder badge on success.
//   - Registry must expose all four enum entries (placeholder + fiken +
//     tripletex + stripe). Fase 2 wires fiken/tripletex/stripe to the
//     PlaceholderAdapter as fallback; Fase 3 replaces those entries.
//
// Failure to hold these is a schema-level audit violation — the
// sync_integration handler assumes the contract when it asserts
// is_placeholder alignment.

import { describe, expect, test } from "vitest";
import { PlaceholderAdapter } from "../adapters/placeholder";
import { getIntegrationAdapter, integrationAdapterRegistry } from "../registry";
import type { SyncInput } from "../types";
import type { BillingIntegration } from "../../types";

// Minimal row — only fields the adapter needs. Cast via unknown to
// avoid duplicating the full generated Row type in the test file.
function row(overrides: Partial<BillingIntegration> = {}): BillingIntegration {
  return {
    integration_id: "11111111-1111-1111-1111-111111111111",
    workspace_id: null,
    integration_type: "placeholder",
    display_name: "Test placeholder",
    config: {},
    is_enabled: true,
    is_placeholder: true,
    last_sync_at: null,
    last_sync_status: null,
    created_at: "2026-05-11T00:00:00Z",
    updated_at: "2026-05-11T00:00:00Z",
    ...overrides,
  } as unknown as BillingIntegration;
}

function syncInput(): SyncInput {
  return {
    integration: row(),
    entity_type: "invoice",
    operation: "create",
    payload: {},
  };
}

describe("PlaceholderAdapter.sync", () => {
  test("returns status=mocked (ADR-0129 — never 'succeeded')", async () => {
    const result = await PlaceholderAdapter.sync(syncInput());
    expect(result.status).toBe("mocked");
  });

  test("returns external_reference=null on mocked outcome", async () => {
    const result = await PlaceholderAdapter.sync(syncInput());
    if (result.status === "mocked") {
      expect(result.external_reference).toBeNull();
    } else {
      throw new Error("Expected 'mocked' status");
    }
  });

  test("supports all five entity kinds (customer, invoice, contract, product, plan)", () => {
    expect(PlaceholderAdapter.supports).toEqual(
      expect.arrayContaining(["customer", "invoice", "contract", "product", "plan"]),
    );
  });

  test("type is 'placeholder'", () => {
    expect(PlaceholderAdapter.type).toBe("placeholder");
  });
});

describe("PlaceholderAdapter.testConnection", () => {
  test("returns status=ok with is_placeholder=true", async () => {
    const result = await PlaceholderAdapter.testConnection(row());
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.is_placeholder).toBe(true);
    }
  });
});

describe("integrationAdapterRegistry", () => {
  test("exposes 'placeholder' entry", () => {
    expect(integrationAdapterRegistry.placeholder).toBeDefined();
    expect(integrationAdapterRegistry.placeholder).toBe(PlaceholderAdapter);
  });

  test("exposes 'fiken' entry (Fase 2 falls back to PlaceholderAdapter)", () => {
    expect(integrationAdapterRegistry.fiken).toBeDefined();
    // Fase 2 wiring — Fase 3 replaces this with the real adapter.
    expect(integrationAdapterRegistry.fiken).toBe(PlaceholderAdapter);
  });

  test("exposes 'tripletex' entry (Fase 2 falls back to PlaceholderAdapter)", () => {
    expect(integrationAdapterRegistry.tripletex).toBeDefined();
    expect(integrationAdapterRegistry.tripletex).toBe(PlaceholderAdapter);
  });

  test("exposes 'stripe' entry (Fase 2 falls back to PlaceholderAdapter)", () => {
    expect(integrationAdapterRegistry.stripe).toBeDefined();
    expect(integrationAdapterRegistry.stripe).toBe(PlaceholderAdapter);
  });

  test("getIntegrationAdapter() lookup matches direct access", () => {
    expect(getIntegrationAdapter("placeholder")).toBe(integrationAdapterRegistry.placeholder);
    expect(getIntegrationAdapter("fiken")).toBe(integrationAdapterRegistry.fiken);
    expect(getIntegrationAdapter("tripletex")).toBe(integrationAdapterRegistry.tripletex);
    expect(getIntegrationAdapter("stripe")).toBe(integrationAdapterRegistry.stripe);
  });
});
