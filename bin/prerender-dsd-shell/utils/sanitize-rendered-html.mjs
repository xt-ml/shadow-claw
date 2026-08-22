export function sanitizeRenderedHtml(html) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/giu, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/giu, "");
}
