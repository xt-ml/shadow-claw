export function resolveCustomElementScripts(config, theme = {}) {
  const customElConfig = config.customElements;
  const rawScripts =
    (typeof customElConfig === "object" && !Array.isArray(customElConfig)
      ? customElConfig.scripts
      : customElConfig) ||
    config.scripts ||
    theme.scripts ||
    [];

  const allowedDomains =
    (typeof customElConfig === "object" && !Array.isArray(customElConfig)
      ? customElConfig.allowedDomains
      : undefined) ||
    config.allowedCustomElementDomains ||
    [];

  return { rawScripts, allowedDomains };
}
