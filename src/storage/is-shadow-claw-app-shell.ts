/**
 * Detect whether a text payload is the ShadowClaw SPA app shell (containing the
 * root `<shadow-claw>` host element or `data-shadow-claw-dsd` marker) rather
 * than a template page or MEMORY.md that happens to reference `<shadow-claw-*>`
 * custom elements.
 */
export function isShadowClawAppShell(text: string): boolean {
  return (
    /<shadow-claw(?:\s|>|\/|$)/i.test(text) ||
    text.includes("data-shadow-claw-dsd")
  );
}
