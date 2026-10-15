import { ShadowClawDatabase } from "../../../../db/types.js";
import { GitToolDeps } from "../../../../subsystems/git/types.js";
import { isHeadlessMode } from "../../../../config/headless.js";

export async function resolveCorsProxy(
  db: ShadowClawDatabase,
  deps: GitToolDeps,
): Promise<string | undefined> {
  const pref = await deps.getConfig(db, deps.configKeys.GIT_CORS_PROXY);
  const customUrl = await deps.getConfig(db, deps.configKeys.GIT_PROXY_URL);

  if (pref === "custom" && customUrl) {
    return deps.getProxyUrl("custom", customUrl);
  }
  if (pref === "public") {
    return deps.getProxyUrl("public");
  }
  if (pref === "direct" || pref === "none") {
    return undefined;
  }
  if (isHeadlessMode()) {
    // In headless Node.js mode, direct fetch has no browser CORS restrictions
    return undefined;
  }

  return deps.getProxyUrl("local");
}
