/**
 * orchestrator.test.ts
 *
 * Verifies grouped capped output and confirms all search modes execute in parallel.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSearchOrchestrator, type SearchGroup } from "../orchestrator";

const rpcMock = vi.fn<
  (
    name: string,
    args: { p_workspace_id: string; p_query: string; p_limit: number },
  ) => Promise<{
    data: unknown;
    error: null;
  }>
>();

vi.mock("@smartout/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: rpcMock,
  })),
}));

/**
 * Waits a short async delay used to model independent mode execution latency.
 */
async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("runSearchOrchestrator", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("returns grouped results with hard caps", async () => {
    rpcMock.mockImplementation(async (name) => {
      if (name === "search_instance") {
        return {
          data: [
            {
              result_id: "p-1",
              title: "Alice",
              subtitle: "Manager",
              deep_link: "/dashboard/people/p-1",
              relevance: 0.95,
            },
            {
              result_id: "p-2",
              title: "Bob",
              subtitle: "Employee",
              deep_link: "/dashboard/people/p-2",
              relevance: 0.91,
            },
            {
              result_id: "p-3",
              title: "Carol",
              subtitle: "Employee",
              deep_link: "/dashboard/people/p-3",
              relevance: 0.9,
            },
          ],
          error: null,
        };
      }

      return {
        data: [
          {
            policy_id: "pol-1",
            policy_name: "Allergens",
            protocol_name: "Kitchen checks",
          },
          {
            policy_id: "pol-2",
            policy_name: "Hygiene",
            protocol_name: "Hand wash",
          },
          {
            policy_id: "pol-3",
            policy_name: "Fire safety",
            protocol_name: null,
          },
        ],
        error: null,
      };
    });

    const semanticRunner = vi.fn(
      async (): Promise<SearchGroup> => ({
        group: "knowledge",
        results: [
          {
            id: "k-1",
            title: "Allergen routine",
            subtitle: "Handbook",
            deepLink: "/dashboard/governance",
            relevance: 0.88,
          },
          {
            id: "k-2",
            title: "Open shift checklist",
            subtitle: "Protocol",
            deepLink: "/dashboard/governance",
            relevance: 0.84,
          },
          {
            id: "k-3",
            title: "Close shift checklist",
            subtitle: "Protocol",
            deepLink: "/dashboard/governance",
            relevance: 0.81,
          },
        ],
      }),
    );

    const out = await runSearchOrchestrator(
      {
        workspaceId: "w1",
        query: "allergen",
        limitPerGroup: 2,
      },
      { runSemanticSearch: semanticRunner },
    );

    expect(out.groups).toHaveLength(3);
    expect(out.groups.every((group) => group.results.length <= 2)).toBe(true);
    expect(out.groups.map((group) => group.group)).toEqual(["people", "knowledge", "policies"]);
  });

  it("runs all modes in parallel", async () => {
    rpcMock.mockImplementation(async (name) => {
      await wait(80);
      if (name === "search_instance") {
        return { data: [], error: null };
      }
      return { data: [], error: null };
    });

    const semanticRunner = vi.fn(async (): Promise<SearchGroup> => {
      await wait(80);
      return { group: "knowledge", results: [] };
    });

    const startedAt = Date.now();
    const out = await runSearchOrchestrator(
      {
        workspaceId: "w1",
        query: "allergen",
        limitPerGroup: 5,
      },
      { runSemanticSearch: semanticRunner },
    );
    const elapsedMs = Date.now() - startedAt;

    expect(elapsedMs).toBeLessThan(180);
    expect(out.groups).toEqual([]);
  });

  it("respects people mode and skips non-people groups", async () => {
    rpcMock.mockImplementation(async (name) => {
      if (name === "search_instance") {
        return {
          data: [
            {
              result_id: "p-1",
              title: "Alice",
              subtitle: "Manager",
              deep_link: "/dashboard/people/p-1",
              relevance: 0.95,
            },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    });

    const semanticRunner = vi.fn(
      async (): Promise<SearchGroup> => ({
        group: "knowledge",
        results: [
          {
            id: "k-1",
            title: "Allergen routine",
            subtitle: "Handbook",
            deepLink: "/dashboard/governance",
            relevance: 0.88,
          },
        ],
      }),
    );

    const out = await runSearchOrchestrator(
      {
        workspaceId: "w1",
        query: "alice",
        mode: "people",
      },
      { runSemanticSearch: semanticRunner },
    );

    expect(out.groups.map((group) => group.group)).toEqual(["people"]);
    expect(semanticRunner).not.toHaveBeenCalled();
  });
});
