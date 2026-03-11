export type IntentResult = {
  id: string;
  message: string;
  expected: string;
  actual: string;
  confidence: number;
  min_confidence: number;
  pass: boolean;
  time_ms: number;
};

export type QualityResult = {
  id: string;
  message: string;
  scores: { criterion: string; score: number; reasoning: string }[];
  overall: number;
  time_ms: number;
};

export function printIntentReport(results: IntentResult[]): void {
  console.log("\n=== Tier 1: Intent Classification ===\n");

  for (const r of results) {
    const icon = r.pass ? "PASS" : "FAIL";
    console.log(
      `[${icon}] [${r.id}] "${r.message.slice(0, 40)}..." -> ${r.actual} (${r.confidence.toFixed(2)}) ${r.pass ? "PASS" : `FAIL (expected: ${r.expected})`} [${r.time_ms}ms]`,
    );
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(
    `\nResult: ${passed}/${results.length} passed (${Math.round((passed / results.length) * 100)}%)\n`,
  );
}

export function printQualityReport(results: QualityResult[]): void {
  console.log("\n=== Tier 2: Response Quality ===\n");

  for (const r of results) {
    console.log(
      `[${r.id}] "${r.message.slice(0, 40)}..." -- Overall: ${r.overall.toFixed(1)}/5 [${r.time_ms}ms]`,
    );
    for (const s of r.scores) {
      const label = s.score >= 4 ? "GOOD" : s.score >= 2 ? "WARN" : "FAIL";
      console.log(`  [${label}] ${s.criterion}: ${s.score}/5 -- ${s.reasoning}`);
    }
    console.log();
  }

  const avg = results.reduce((sum, r) => sum + r.overall, 0) / results.length;
  console.log(`Average: ${avg.toFixed(1)}/5\n`);
}
