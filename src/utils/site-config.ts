let cachedConfigs = new Map<string, { rawText: string; config: any }>();

export function resetSiteConfigCache(): void {
  cachedConfigs.clear();
}

/**
 * Retrieves and normalizes embedded site configuration from a `<script type="application/json">`
 * element (default ID: `shadow-claw-site-config`, or custom ID specified via `element.getAttribute("config")`).
 */
export function getSiteConfig(element?: Element | null): any | null {
  if (typeof document === "undefined") {
    return null;
  }

  let targetId = "shadow-claw-site-config";
  if (element) {
    const customConfigRef = element.getAttribute("config")?.trim();
    if (customConfigRef) {
      targetId = customConfigRef.replace(/^#/, "");
    }
  }

  const scriptEl = document.getElementById(targetId);
  if (!scriptEl?.textContent) {
    cachedConfigs.delete(targetId);
    return null;
  }

  const cacheEntry = cachedConfigs.get(targetId);
  if (cacheEntry && cacheEntry.rawText === scriptEl.textContent) {
    return cacheEntry.config;
  }

  try {
    const raw = JSON.parse(scriptEl.textContent);
    if (!raw || typeof raw !== "object") {
      cachedConfigs.delete(targetId);
      return null;
    }

    const config = { ...raw };

    cachedConfigs.set(targetId, { rawText: scriptEl.textContent, config });
    return config;
  } catch (err) {
    console.warn(
      `[ShadowClaw] Failed to parse site configuration from #${targetId}:`,
      err,
    );
    return null;
  }
}
