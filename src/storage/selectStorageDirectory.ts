import { CONFIG_KEYS } from "../config.js";
import { setConfig } from "../db/setConfig.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Select a local directory for storage using the File System Access API.
 */
export async function selectStorageDirectory(
  db: ShadowClawDatabase,
): Promise<boolean> {
  const pickerMaybe = Reflect.get(globalThis, "showDirectoryPicker");
  const picker =
    typeof pickerMaybe === "function" ? pickerMaybe.bind(globalThis) : null;

  if (!picker) {
    throw new Error(
      "Local folder picker is unavailable in this browser/context.",
    );
  }

  try {
    const handle = await picker({
      mode: "readwrite",
      id: "shadowclaw-storage",
    });

    // Verify it's not the same as OPFS or something restricted
    // (Most browsers handle this, but good to have a handle)
    await setConfig(db, CONFIG_KEYS.STORAGE_HANDLE, handle);

    return true;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return false;
    }

    throw err;
  }
}
