import { ShadowClawDatabase } from "../../../../db/types";
import { GitToolDeps } from "../../../../subsystems/git/types";

export async function resolveCorsProxy(
  db: ShadowClawDatabase,
  deps: GitToolDeps,
): Promise<string> {
  const pref = await deps.getConfig(db, deps.configKeys.GIT_CORS_PROXY);
  const customUrl = await deps.getConfig(db, deps.configKeys.GIT_PROXY_URL);

  return deps.getProxyUrl(
    pref === "public" ? "public" : pref === "custom" ? "custom" : "local",
    customUrl,
  );
}
