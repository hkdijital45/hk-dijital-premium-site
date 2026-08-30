// Deterministic A/B winner logic — no AI, no fabricated significance.
// Minimum sample size guards against calling a winner on noise.
const MIN_SAMPLE_SIZE = 200;

export function evaluateAbTest(metrics: { variantA: { impressions: number; conversions: number }; variantB: { impressions: number; conversions: number } }) {
  const { variantA, variantB } = metrics;
  if (variantA.impressions < MIN_SAMPLE_SIZE || variantB.impressions < MIN_SAMPLE_SIZE) {
    return { status: "insufficient_data" as const, winner: null, rateA: null, rateB: null };
  }

  const rateA = variantA.conversions / variantA.impressions;
  const rateB = variantB.conversions / variantB.impressions;
  const relativeDifference = Math.abs(rateA - rateB) / Math.max(rateA, rateB, 0.0001);

  if (relativeDifference < 0.1) {
    return { status: "completed" as const, winner: "inconclusive" as const, rateA, rateB };
  }

  return { status: "completed" as const, winner: (rateA > rateB ? "a" : "b") as "a" | "b", rateA, rateB };
}
