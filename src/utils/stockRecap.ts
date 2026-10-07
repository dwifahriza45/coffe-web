import { stockDisplayUnits } from "./stockDisplay";

export function stockRecap(input: {
  closing: boolean; waiters: boolean; opening: number | null; incoming: number;
  outgoing: number; adjustment: number; physical: number | null;
  minimum: number | null; target: number | null; baseUnit: string;
  packaging: string; contentUnit: string; contentQty: number; packageQty: number;
}) {
  const expected = input.closing && input.opening !== null ? input.opening + input.incoming - input.outgoing + input.adjustment : null;
  const consumption = input.closing && input.physical !== null && input.opening !== null
    ? input.waiters ? input.opening + input.incoming + input.adjustment - input.physical : input.outgoing
    : null;
  const variance = !input.waiters && input.physical !== null && expected !== null ? input.physical - expected : null;
  const invalid = consumption !== null && consumption < 0;
  const needsOrder = input.physical !== null && input.minimum !== null ? input.physical < input.minimum : null;
  // Keep the package identity even when its unit is the same as a GR/KG toggle.
  const unit = stockDisplayUnits(input.baseUnit, "kemasan", input.contentUnit, input.contentQty, input.packageQty).find((choice) => choice.key === "package");
  const packageSize = unit?.divisor ?? null;
  const equivalents = input.physical !== null && packageSize !== null ? input.physical / packageSize : null;
  const targetValid = input.target !== null && input.target > 0 && input.minimum !== null && input.target >= input.minimum;
  const suggestion = invalid || needsOrder === null || !targetValid || packageSize === null || input.physical === null ? null
    : needsOrder ? Math.max(0, Math.ceil((input.target! - input.physical) / packageSize - 1e-10)) : 0;
  return { expected, consumption, variance, invalid, needsOrder, equivalents, suggestion };
}
