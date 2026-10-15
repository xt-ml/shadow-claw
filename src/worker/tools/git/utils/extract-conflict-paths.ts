export function extractConflictPaths(message: string): string[] {
  const match = message.match(/conflicts? in the following files?:\s*(.+)/i);
  if (match) {
    return match[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}
