#!/usr/bin/env tsx
// Run agent evals. Usage:
//   pnpm eval:intent     -- Tier 1 only (fast)
//   pnpm eval:quality    -- Tier 2 only (uses LLM judge)
//   pnpm eval            -- Both tiers

import intentCases from "./cases/intent.json" with { type: "json" };
import qualityCases from "./cases/quality.json" with { type: "json" };
import { judgeResponse } from "./judges/response-judge.js";
import {
  printIntentReport,
  printQualityReport,
  type IntentResult,
  type QualityResult,
} from "./report.js";

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:5010";
const API_KEY = process.env.TEST_API_KEY;
const PROFILE_ID = process.env.TEST_PROFILE_ID;

if (!API_KEY || !PROFILE_ID) {
  console.error("Required env vars: TEST_API_KEY, TEST_PROFILE_ID");
  process.exit(1);
}

const tier = process.argv[2] ?? "all"; // "intent", "quality", or "all"

type ChatResponse = {
  session_id: string;
  response: string;
  intent?: { capability: string; confidence: number };
};

async function chat(message: string): Promise<{ data: ChatResponse; time_ms: number }> {
  const start = Date.now();
  const res = await fetch(`${ENGINE_URL}/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY! },
    body: JSON.stringify({
      message,
      profile_id: PROFILE_ID,
      channel: "chat",
    }),
  });
  const time_ms = Date.now() - start;

  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const data = (await res.json()) as ChatResponse;
  return { data, time_ms };
}

async function runIntentEvals(): Promise<void> {
  const results: IntentResult[] = [];

  for (const c of intentCases.cases) {
    try {
      const { data, time_ms } = await chat(c.message);
      const actual = data.intent?.capability ?? "unknown";
      const confidence = data.intent?.confidence ?? 0;
      const pass = actual === c.expected_capability && confidence >= c.min_confidence;
      results.push({
        id: c.id,
        message: c.message,
        expected: c.expected_capability,
        actual,
        confidence,
        min_confidence: c.min_confidence,
        pass,
        time_ms,
      });
    } catch {
      results.push({
        id: c.id,
        message: c.message,
        expected: c.expected_capability,
        actual: "ERROR",
        confidence: 0,
        min_confidence: c.min_confidence,
        pass: false,
        time_ms: 0,
      });
    }
  }

  printIntentReport(results);
}

async function runQualityEvals(): Promise<void> {
  const results: QualityResult[] = [];

  for (const c of qualityCases.cases) {
    try {
      const { data, time_ms } = await chat(c.message);
      const judgment = await judgeResponse({
        message: c.message,
        response: data.response,
        criteria: c.criteria,
      });
      results.push({
        id: c.id,
        message: c.message,
        scores: judgment.scores,
        overall: judgment.overall,
        time_ms,
      });
    } catch {
      results.push({
        id: c.id,
        message: c.message,
        scores: [],
        overall: 0,
        time_ms: 0,
      });
    }
  }

  printQualityReport(results);
}

async function main() {
  console.log(`Engine: ${ENGINE_URL}`);
  console.log(`Profile: ${PROFILE_ID}\n`);

  if (tier === "intent" || tier === "all") await runIntentEvals();
  if (tier === "quality" || tier === "all") await runQualityEvals();
}

main().catch(console.error);
