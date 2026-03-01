// ============================================
// e2e.ts
// End-to-end test for the Stage Engine lifecycle.
// Runs the complete flow: start → fetch → store → advance (x3) → complete.
// Uses the "discovery-call" seed mission.
// Run with: pnpm test:e2e (requires engine running + seed data)
// ============================================

const BASE_URL = process.env.ENGINE_URL || "http://localhost:3000";
const API_KEY = process.env.TEST_API_KEY || "";

/** Helper: make authenticated requests to the engine */
async function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  return { status: res.status, data };
}

/** Simple assertion helper */
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

async function runE2E(): Promise<void> {
  console.log("=== Stage Engine E2E Test ===\n");

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthData = (await healthRes.json()) as { status: string };
  assert(healthRes.status === 200, "Health endpoint returns 200");
  assert(healthData.status === "ok", "Health status is ok");

  // 2. Start session
  const startRes = await request("POST", "/sessions", {
    mission_id: "discovery-call",
    workspace_id: "00000000-0000-0000-0000-000000000001", // Replace with valid workspace
    channel: "chat",
  });
  assert(startRes.status === 200, "Session created successfully");

  const session = startRes.data as {
    session_id: string;
    mission: { id: string; mode: string };
    current_stage: { stage_id: string; goal: string };
    progress: string;
    system_prompt: string;
  };
  assert(session.mission.id === "discovery-call", "Mission is discovery-call");
  assert(session.current_stage.stage_id === "greeting", "First stage is greeting");
  assert(session.progress === "1/3", "Progress is 1/3");
  assert(session.system_prompt.length > 0, "System prompt is non-empty");

  const sessionId = session.session_id;

  // 3. Fetch context
  const fetchRes = await request("POST", `/sessions/${sessionId}/fetch`, {
    query_type: "context",
  });
  assert(fetchRes.status === 200, "Fetch context returns 200");

  // 4. Store data for stage 1 (greeting)
  const storeRes = await request("POST", `/sessions/${sessionId}/store`, {
    entity_type: "person",
    data: { name: "Pontus", role: "CEO" },
  });
  assert(storeRes.status === 200, "Store returns 200");
  const storeData = storeRes.data as { confirmed: boolean; inbox_id: string };
  assert(storeData.confirmed === true, "Store confirmed");

  // 5. Advance to stage 2 (problem)
  const adv1 = await request("POST", `/sessions/${sessionId}/advance`, {
    result: { name: "Pontus", role: "CEO" },
  });
  assert(adv1.status === 200, "Advance to stage 2 returns 200");
  const adv1Data = adv1.data as {
    new_stage: { stage_id: string };
    complete: boolean;
    progress: string;
  };
  assert(adv1Data.new_stage.stage_id === "problem", "Now on problem stage");
  assert(adv1Data.complete === false, "Not complete yet");
  assert(adv1Data.progress === "2/3", "Progress is 2/3");

  // 6. Store data for stage 2 (problem)
  await request("POST", `/sessions/${sessionId}/store`, {
    entity_type: "problem",
    data: { description: "Employee onboarding takes too long" },
  });

  // 7. Advance to stage 3 (confirm)
  const adv2 = await request("POST", `/sessions/${sessionId}/advance`, {
    result: { problem: "Employee onboarding takes too long" },
  });
  assert(adv2.status === 200, "Advance to stage 3 returns 200");
  const adv2Data = adv2.data as { new_stage: { stage_id: string }; progress: string };
  assert(adv2Data.new_stage.stage_id === "confirm", "Now on confirm stage");
  assert(adv2Data.progress === "3/3", "Progress is 3/3");

  // 8. Store data for stage 3 (confirm)
  await request("POST", `/sessions/${sessionId}/store`, {
    entity_type: "confirmation",
    data: { confirmed: true, summary: "Pontus, CEO, needs faster onboarding" },
  });

  // 9. Advance — should complete
  const adv3 = await request("POST", `/sessions/${sessionId}/advance`, {
    result: { confirmed: true },
  });
  assert(adv3.status === 200, "Final advance returns 200");
  const adv3Data = adv3.data as { complete: boolean; progress: string; summary: string };
  assert(adv3Data.complete === true, "Session is complete");

  // 10. Verify session status
  const statusRes = await request("GET", `/sessions/${sessionId}`);
  assert(statusRes.status === 200, "Get session status returns 200");
  const statusData = statusRes.data as { status: string; collected_data: Record<string, unknown> };
  assert(statusData.status === "complete", "Session status is complete");
  assert(Object.keys(statusData.collected_data).length === 3, "Collected data has 3 stages");

  // 11. Verify inbox entries
  const inboxRes = await request("POST", `/sessions/${sessionId}/fetch`, {
    query_type: "inbox",
  });
  assert(inboxRes.status === 200, "Fetch inbox returns 200");
  const inboxData = inboxRes.data as { data: { entries: unknown[] } };
  assert(inboxData.data.entries.length === 3, "Inbox has 3 entries");

  console.log("\n=== All tests passed! ===");
}

runE2E().catch((err) => {
  console.error("E2E test failed:", err);
  process.exit(1);
});
