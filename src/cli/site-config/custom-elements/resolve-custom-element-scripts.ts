import type { CustomElementScriptEntry } from "./build-custom-element-script-tags.js";

export interface ResolvedCustomElementScripts {
  rawScripts: CustomElementScriptEntry[];
  allowedDomains: string[];
}

export function resolveCustomElementScripts(
  config: any = {},
  theme: any = {},
): ResolvedCustomElementScripts {
  const customElConfig = config.customElements;
  const rawScripts: CustomElementScriptEntry[] =
    (typeof customElConfig === "object" && !Array.isArray(customElConfig)
      ? customElConfig.scripts
      : customElConfig) ||
    config.scripts ||
    theme.scripts ||
    [];

  const allowedDomains: string[] =
    (typeof customElConfig === "object" && !Array.isArray(customElConfig)
      ? customElConfig.allowedDomains
      : undefined) ||
    config.allowedCustomElementDomains ||
    [];

  return { rawScripts, allowedDomains };
}
