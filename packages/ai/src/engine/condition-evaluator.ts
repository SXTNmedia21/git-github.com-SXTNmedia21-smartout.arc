type Context = Record<string, unknown>;

export function evaluateCondition(condition: unknown, context: Context): boolean {
  if (condition === null || condition === undefined) return true;

  const cond = condition as Record<string, unknown>;

  if ("match" in cond) {
    const match = cond.match as Record<string, unknown>;
    return Object.entries(match).every(([key, value]) => context[key] === value);
  }

  if ("step_status" in cond) {
    const { step, is } = cond.step_status as { step: number; is: string };
    const results = context.step_results as Record<string, { status: string }> | undefined;
    return results?.[step]?.status === is;
  }

  if ("all" in cond) {
    const conditions = cond.all as unknown[];
    return conditions.every((c) => evaluateCondition(c, context));
  }

  if ("any" in cond) {
    const conditions = cond.any as unknown[];
    return conditions.some((c) => evaluateCondition(c, context));
  }

  return false;
}
