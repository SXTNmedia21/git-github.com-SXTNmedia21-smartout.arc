// services/voice-agent/scripts/vad-bench/percentile.ts
//
// Nearest-rank percentile calculation. We deliberately do NOT use linear
// interpolation — bench targets are integer ms thresholds, so the more
// pessimistic nearest-rank reading is preferred (a P95 = 901 must fail
// even if interpolated P95 would round to 900).

export function percentile(values: readonly number[], quantile: number): number {
  if (values.length === 0) return NaN;
  const q = Math.min(1, Math.max(0, quantile));
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(q * sorted.length) - 1;
  const idx = Math.min(Math.max(rank, 0), sorted.length - 1);
  return sorted[idx];
}
