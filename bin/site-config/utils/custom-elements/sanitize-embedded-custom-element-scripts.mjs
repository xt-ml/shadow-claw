import { isCustomElementScriptDomainAllowed } from "./is-custom-element-script-domain-allowed.mjs";

export function sanitizeEmbeddedCustomElementScripts(config, allowedDomains) {
  const sanitizedConfig = JSON.parse(JSON.stringify(config));

  if (
    sanitizedConfig.customElements &&
    typeof sanitizedConfig.customElements === "object" &&
    Array.isArray(sanitizedConfig.customElements.scripts)
  ) {
    sanitizedConfig.customElements.scripts =
      sanitizedConfig.customElements.scripts.filter((entry) => {
        const src = typeof entry === "string" ? entry : entry?.src;
        return src
          ? isCustomElementScriptDomainAllowed(src, allowedDomains)
          : false;
      });
  }

  return sanitizedConfig;
}
