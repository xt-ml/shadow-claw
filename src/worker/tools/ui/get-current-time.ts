export function executeGetCurrentTime(input: Record<string, any>): string {
  const d = new Date();
  const tz = input.timezone;
  if (tz) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeStyle: "long",
        dateStyle: "long",
      }).format(d);
    } catch (e: any) {
      return `Error: Invalid timezone ${tz} - ${e.message}`;
    }
  }

  return d.toISOString();
}
