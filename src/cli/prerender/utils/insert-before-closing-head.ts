export function insertBeforeClosingHead(
  html: string,
  contentToInsert: string,
): string {
  const headMatch = /<\/head>/i.exec(html);
  if (headMatch) {
    const headIndex = headMatch.index;
    return (
      html.slice(0, headIndex) + contentToInsert + "\n" + html.slice(headIndex)
    );
  }
  return `${contentToInsert}\n${html}`;
}
