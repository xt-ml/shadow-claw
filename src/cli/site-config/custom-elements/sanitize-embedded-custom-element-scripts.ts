import { isCustomElementScriptDomainAllowed } from "./is-custom-element-script-domain-allowed.js";

export function sanitizeEmbeddedCustomElementScripts(
  config: any,
  allowedDomains?: string[] | string,
): any {
  const sanitizedConfig = JSON.parse(JSON.stringify(config));

  if (
    sanitizedConfig.customElements &&
    typeof sanitizedConfig.customElements === "object" &&
    Array.isArray(sanitizedConfig.customElements.scripts)
  ) {
    sanitizedConfig.customElements.scripts =
      sanitizedConfig.customElements.scripts.filter((entry: any) => {
        const src = typeof entry === "string" ? entry : entry?.src;
        return src
          ? isCustomElementScriptDomainAllowed(src, allowedDomains)
          : false;
      });
  }

  return sanitizedConfig;
}
