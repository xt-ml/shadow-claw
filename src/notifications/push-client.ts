/**
 * Client-side Web Push subscription management.
 * Runs in the browser — communicates with the server's push routes.
 */

import { CONFIG_KEYS } from "../config.js";
import { getDb } from "../db/db.js";
import { getConfig } from "../db/getConfig.js";

/**
 * Resolve a push route URL, optionally using a configured proxy.
 */
export async function getPushUrl(path: string): Promise<string> {
  const db = await getDb();
  const proxyUrl = await getConfig(db, CONFIG_KEYS.PUSH_PROXY_URL);

  if (!proxyUrl) {
    return path;
  }

  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  // Ensure proxyUrl doesn't end with /
  const normalizedProxy = proxyUrl.endsWith("/")
    ? proxyUrl.slice(0, -1)
    : proxyUrl;

  return `${normalizedProxy}${normalizedPath}`;
}

/**
 * Convert a URL-safe base64 string to a Uint8Array.
 * Required for PushManager.subscribe() applicationServerKey.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);

  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Fetch the VAPID public key from the server.
 */
export async function getVapidPublicKey(): Promise<string> {
  const url = await getPushUrl("/push/vapid-public-key");
  const res = await fetch(url);
  const data = await res.json();

  return data.publicKey;
}

/**
 * Subscribe to push notifications.
 * Requests permission, creates a push subscription, and sends it to the server.
 */
export async function subscribeToPush(): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.ready;
  const publicKey = await getVapidPublicKey();

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as any,
  });

  const url = await getPushUrl("/push/subscribe");
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });

  return subscription;
}

/**
 * Unsubscribe from push notifications.
 * Removes the push subscription locally and notifies the server.
 */
export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    return;
  }

  const { endpoint } = subscription;
  await subscription.unsubscribe();

  const url = await getPushUrl("/push/subscribe");
  await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}

/**
 * Get the current push subscription (or null if not subscribed).
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;

  return registration.pushManager.getSubscription();
}
