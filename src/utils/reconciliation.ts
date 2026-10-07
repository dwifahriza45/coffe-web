export function reconciliationResult(input: { waiters: boolean; opening: number | null; incoming: number; outgoing: number; adjustment: number; physical: number | null }) {
  const expected = input.opening === null ? null : input.opening + input.incoming - input.outgoing + input.adjustment;
  if (input.physical === null || input.opening === null) return { expected, usage: null, variance: null, status: "PENDING" as const };
  if (input.waiters) {
    const usage = input.opening + input.incoming + input.adjustment - input.physical;
    return { expected: null, usage, variance: null, status: usage < -0.000001 || input.physical < 0 ? "CHECK" as const : "RECORDED" as const };
  }
  const delta = input.physical - expected!;
  const variance = Math.abs(delta) < 0.000001 ? 0 : delta;
  return { expected, usage: input.outgoing, variance, status: variance === 0 ? "MATCHED" as const : "VARIANCE" as const };
}
