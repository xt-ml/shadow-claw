/**
 * Finds the index of the top-level </head> closing tag in an HTML document,
 * skipping any occurrences of "</head>" inside <script>, <style>, <template>,
 * or HTML comments (<!-- ... -->).
 */
export function findClosingHeadIndex(html: string): number {
  const tokenRegex =
    /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<template\b[\s\S]*?<\/template>|<\/head>/gi;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(html)) !== null) {
    if (match[0].toLowerCase().startsWith("</head")) {
      return match.index;
    }
  }
  return -1;
}

export function insertBeforeClosingHead(
  html: string,
  contentToInsert: string,
): string {
  const headIndex = findClosingHeadIndex(html);
  if (headIndex !== -1) {
    return (
      html.slice(0, headIndex) + contentToInsert + "\n" + html.slice(headIndex)
    );
  }
  return `${contentToInsert}\n${html}`;
}
