export function insertBeforeClosingHead(html, contentToInsert) {
  const lastHeadIndex = html.lastIndexOf("</head>");
  if (lastHeadIndex !== -1) {
    return (
      html.slice(0, lastHeadIndex) +
      contentToInsert +
      "\n" +
      html.slice(lastHeadIndex)
    );
  }
  return `${contentToInsert}\n${html}`;
}
