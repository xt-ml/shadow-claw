import { isCustomElementScriptDomainAllowed } from "./is-custom-element-script-domain-allowed.mjs";

export function getApprovedCustomElementScripts(
  rawScripts,
  allowedDomains,
  warn = console.warn,
) {
  if (!Array.isArray(rawScripts) || rawScripts.length === 0) {
    return [];
  }

  return rawScripts.filter((entry) => {
    const src = typeof entry === "string" ? entry : entry?.src;
    if (!src) return false;

    if (!isCustomElementScriptDomainAllowed(src, allowedDomains)) {
      warn(
        `[Security] Skipping script from unapproved domain during build: ${src}`,
      );
      return false;
    }

    return true;
  });
}
