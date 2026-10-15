export function truncateSnippet(text: string, maxLines: number): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) {
    return text;
  }

  return (
    lines.slice(0, maxLines).join("\n") +
    "\n    [... " +
    (lines.length - maxLines) +
    " more lines]"
  );
}
