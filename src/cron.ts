// =========================================================================
// Cron expression parser (lightweight, no dependencies)
// =========================================================================
// Format: minute hour day-of-month month day-of-week
// Supports: * (any), N (exact), N-M (range), N,M (list), */N (step)

/**
 * Match a cron expression against a date
 */
export function matchesCron(expr: string, date: Date): boolean {
  if (typeof expr !== "string" || !expr.trim()) {
    return false;
  }

  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return false;
  }

  const [min, hour, dom, mon, dow] = parts;

  return (
    matchField(min, date.getMinutes()) &&
    matchField(hour, date.getHours()) &&
    matchField(dom, date.getDate()) &&
    matchField(mon, date.getMonth() + 1) &&
    matchField(dow, date.getDay())
  );
}

/**
 * Match a single cron field
 */
function matchField(field: string, value: number): boolean {
  if (field === "*") {
    return true;
  }

  return field.split(",").some((part) => {
    // Step: */N or N/M
    if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step <= 0) {
        return false;
      }

      if (range === "*") {
        return value % step === 0;
      }

      // Range with step: N-M/S
      if (range.includes("-")) {
        const [lo, hi] = range.split("-").map(Number);

        return value >= lo && value <= hi && (value - lo) % step === 0;
      }

      const start = parseInt(range, 10);

      return value >= start && (value - start) % step === 0;
    }

    // Range: N-M
    if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);

      return value >= lo && value <= hi;
    }

    // Exact match

    return parseInt(part, 10) === value;
  });
}
