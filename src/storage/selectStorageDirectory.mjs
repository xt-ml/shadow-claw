import { CONFIG_KEYS } from "../config.mjs";
import { setConfig } from "../db/setConfig.mjs";

/**
 * @typedef {import("../../src/db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Select a local directory for storage using the File System Access API.
 *
 * @param {ShadowClawDatabase} db
 *
 * @returns {Promise<boolean>} Success
 */
export async function selectStorageDirectory(db) {
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
    await setConfig(
      db,
      CONFIG_KEYS.STORAGE_HANDLE,
      /** @type {any} */ (handle),
    );

    return true;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return false;
    throw err;
  }
}
