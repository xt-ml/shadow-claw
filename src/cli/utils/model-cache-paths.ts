import os from "node:os";
import path from "node:path";
import process from "node:process";

export interface SharedCacheDirOptions {
  sharedCache?: boolean;
}

/**
 * Returns the opt-in per-user shared local model cache directory (`~/.cache/shadow-claw/models`
 * or `SHADOWCLAW_MODEL_CACHE_DIR` / `$XDG_CACHE_HOME/shadow-claw/models`).
 */
export function getSharedUserModelCacheDir(): string {
  const custom = (process.env.SHADOWCLAW_MODEL_CACHE_DIR || "").trim();
  if (custom) {
    return path.resolve(custom);
  }

  const cacheBase =
    (process.env.XDG_CACHE_HOME || "").trim() ||
    path.join(os.homedir(), ".cache");
  return path.join(cacheBase, "shadow-claw", "models");
}

/**
 * Returns true when shared user-level disk model caching is explicitly opted in.
 */
export function isSharedModelCacheEnabled(
  options?: SharedCacheDirOptions,
): boolean {
  if (options?.sharedCache === true) {
    return true;
  }

  const envFlag = (process.env.SHADOWCLAW_SHARED_MODEL_CACHE || "")
    .trim()
    .toLowerCase();
  if (envFlag === "1" || envFlag === "true" || envFlag === "yes") {
    return true;
  }

  return Boolean((process.env.SHADOWCLAW_MODEL_CACHE_DIR || "").trim());
}

export function getLocalModelCacheDir(
  customCacheDir?: string,
  options?: SharedCacheDirOptions,
): string {
  if (customCacheDir) {
    return path.resolve(customCacheDir);
  }
  if (isSharedModelCacheEnabled(options)) {
    return path.join(getSharedUserModelCacheDir(), "transformers.js");
  }
  return path.resolve(process.cwd(), "assets/cache/transformers.js");
}

export function getLlamafileCacheDir(
  customCacheDir?: string,
  options?: SharedCacheDirOptions,
): string {
  if (customCacheDir) {
    return path.resolve(customCacheDir, "llamafile");
  }
  if (isSharedModelCacheEnabled(options)) {
    return path.join(getSharedUserModelCacheDir(), "llamafile");
  }
  return path.resolve(process.cwd(), "assets/cache/llamafile");
}

export function getAgentfileCacheDir(
  customCacheDir?: string,
  options?: SharedCacheDirOptions,
): string {
  if (customCacheDir) {
    return path.resolve(customCacheDir, "agentfile");
  }
  if (isSharedModelCacheEnabled(options)) {
    return path.join(getSharedUserModelCacheDir(), "agentfile");
  }
  return path.resolve(process.cwd(), "assets/cache/agentfile");
}
