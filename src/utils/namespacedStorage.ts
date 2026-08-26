import { getDeploymentNamespace } from "../core/app-routes.js";

/**
 * Derive per-deployment namespaced localStorage key.
 * E.g., if deployment namespace is "deploy-1" and key is "assistantName",
 * returns "shadowclaw:deploy-1:assistantName".
 * If deployment namespace is empty, returns raw key.
 */
export function getNamespacedStorageKey(key: string): string {
  const ns = getDeploymentNamespace();
  if (!ns) {
    return key;
  }

  return `shadowclaw:${ns}:${key}`;
}

/**
 * Get item from localStorage under namespaced key.
 * On first read: if namespaced key is missing but legacy unprefixed key is present,
 * copies legacy value to namespaced key (one-time migration) without deleting legacy key.
 */
export function getNamespacedItem(key: string): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const namespacedKey = getNamespacedStorageKey(key);
  try {
    const value = localStorage.getItem(namespacedKey);
    if (value !== null) {
      return value;
    }

    if (namespacedKey === key) {
      return null;
    }

    const legacyValue = localStorage.getItem(key);
    if (legacyValue !== null) {
      localStorage.setItem(namespacedKey, legacyValue);

      return legacyValue;
    }
  } catch (e) {
    console.warn("Unable to read from localStorage:", e);
  }

  return null;
}

/**
 * Set item in localStorage under namespaced key.
 */
export function setNamespacedItem(key: string, value: string): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  const namespacedKey = getNamespacedStorageKey(key);
  try {
    localStorage.setItem(namespacedKey, value);
  } catch (e) {
    console.warn("Unable to write to localStorage:", e);
  }
}

/**
 * Remove item from localStorage under namespaced key.
 */
export function removeNamespacedItem(key: string): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  const namespacedKey = getNamespacedStorageKey(key);
  try {
    localStorage.removeItem(namespacedKey);
  } catch (e) {
    console.warn("Unable to remove from localStorage:", e);
  }
}
