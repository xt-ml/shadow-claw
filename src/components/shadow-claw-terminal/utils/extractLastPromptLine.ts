export function extractLastPromptLine(text: string): string {
  if (!text) {
    return "";
  }

  const lines = text.split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] || "";
    if (/[#$](?:\s|$)/.test(line)) {
      return line;
    }
  }

  return "";
}
