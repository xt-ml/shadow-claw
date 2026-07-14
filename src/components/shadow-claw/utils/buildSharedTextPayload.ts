export function buildSharedTextPayload(share: {
  title: string;
  text: string;
  url: string;
}): string {
  const lines: string[] = ["# Shared Content", ""];

  if (share.title) {
    lines.push(`Title: ${share.title}`);
  }

  if (share.url) {
    lines.push(`URL: ${share.url}`);
  }

  if (share.text) {
    lines.push("", share.text);
  }

  return lines.join("\n").trim() + "\n";
}
