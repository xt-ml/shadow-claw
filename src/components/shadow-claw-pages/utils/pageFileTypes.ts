/**
 * Utility functions for checking page file types.
 */

export function isHtmlPath(path: string): boolean {
  return /\.(html?|xhtml)$/iu.test(path);
}

export function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/iu.test(path);
}
