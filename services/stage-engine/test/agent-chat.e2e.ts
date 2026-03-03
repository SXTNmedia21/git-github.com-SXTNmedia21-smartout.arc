// services/stage-engine/test/agent-chat.e2e.ts
// End-to-end test for the agent chat endpoint.
// Requires: running Stage Engine + Supabase + valid API key.
// Run with: pnpm test:agent

const BASE_URL = process.env.ENGINE_URL ?? "http://localhost:5010";
const API_KEY = process.env.TEST_API_KEY;

if (!API_KEY) {
  console.error("Set TEST_API_KEY env var to a valid workspace API key");
  process.exit(1);
}

async function testAgentChat() {
  console.log("=== Agent Chat E2E Test ===\n");

  const PROFILE_ID = process.env.TEST_PROFILE_ID;
  if (!PROFILE_ID) {
    console.error("Set TEST_PROFILE_ID env var to a valid profile UUID");
    process.exit(1);
  }

  // Test 1: Create new session + send message
  console.log("Test 1: New conversation...");
  const res1 = await fetch(`${BASE_URL}/agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      message: "Hei! Hvem er jeg?",
      profile_id: PROFILE_ID,
    }),
  });

  if (!res1.ok) {
    console.error(`FAIL: ${res1.status} ${await res1.text()}`);
    process.exit(1);
  }

  const data1 = (await res1.json()) as {
    session_id: string;
    response: string;
    intent?: { capability: string; confidence: number };
  };
  console.log(`  Session: ${data1.session_id}`);
  console.log(`  Intent: ${data1.intent?.capability} (${data1.intent?.confidence})`);
  console.log(`  Response: ${data1.response.slice(0, 100)}...`);
  console.log("  PASS\n");

  // Test 2: Continue same session
  console.log("Test 2: Follow-up in same session...");
  const res2 = await fetch(`${BASE_URL}/agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      message: "Hvilket team er jeg pa?",
      session_id: data1.session_id,
      profile_id: PROFILE_ID,
    }),
  });

  if (!res2.ok) {
    console.error(`FAIL: ${res2.status} ${await res2.text()}`);
    process.exit(1);
  }

  const data2 = (await res2.json()) as {
    session_id: string;
    response: string;
    intent?: { capability: string; confidence: number };
  };
  console.log(`  Session: ${data2.session_id} (same: ${data2.session_id === data1.session_id})`);
  console.log(`  Intent: ${data2.intent?.capability} (${data2.intent?.confidence})`);
  console.log(`  Response: ${data2.response.slice(0, 100)}...`);
  console.log("  PASS\n");

  // Test 3: Invalid session ID
  console.log("Test 3: Invalid session ID...");
  const res3 = await fetch(`${BASE_URL}/agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      message: "test",
      session_id: "00000000-0000-0000-0000-000000000000",
      profile_id: PROFILE_ID,
    }),
  });

  if (res3.status !== 404) {
    console.error(`FAIL: Expected 404, got ${res3.status}`);
    process.exit(1);
  }
  console.log("  Got expected 404");
  console.log("  PASS\n");

  console.log("=== All tests passed ===");
}

testAgentChat().catch(console.error);
