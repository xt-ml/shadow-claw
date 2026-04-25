import { Workbox } from "workbox-window";

const RELOAD_FALLBACK_TIMEOUT_MS = 3000;
const UPDATE_INTENT_KEY = "shadowclaw-sw-update-intent";
const UPDATE_INTENT_MAX_AGE_MS = 30000;
const MAX_FALLBACK_RELOAD_ATTEMPTS = 2;
const UPDATE_FAILURE_KEY = "shadowclaw-sw-update-failure";
const UPDATE_FAILURE_COOLDOWN_MS = 5 * 60 * 1000;

let didReloadAfterUpdate = false;
let pendingReloadTimeout: ReturnType<typeof globalThis.setTimeout> | null =
  null;

interface UpdateIntentState {
  startedAt: number;
  fallbackReloadAttempts: number;
}

interface UpdateFailureState {
  failedAt: number;
}

interface ShadowClawUiBridge {
  requestConfirmation?: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean>;
}

async function waitForShadowClawUiBridge(
  timeoutMs = 5000,
): Promise<ShadowClawUiBridge | null> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const bridge = (globalThis as { shadowclaw?: ShadowClawUiBridge })
      .shadowclaw;

    if (bridge?.requestConfirmation) {
      return bridge;
    }

    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, 50);
    });
  }

  return null;
}

async function confirmServiceWorkerUpdate(): Promise<boolean> {
  const shadowclaw = await waitForShadowClawUiBridge();

  if (shadowclaw?.requestConfirmation) {
    return await shadowclaw.requestConfirmation({
      title: "Update Available",
      message:
        "A new version of ShadowClaw is ready. Reload now to apply the update?",
      confirmLabel: "Reload now",
      cancelLabel: "Later",
    });
  }

  // UI bridge was not ready in time; skip this update prompt gracefully.

  return false;
}

async function notifyUpdateFailure(): Promise<void> {
  const shadowclaw = await waitForShadowClawUiBridge();

  if (shadowclaw?.requestConfirmation) {
    await shadowclaw.requestConfirmation({
      title: "Update Failed",
      message:
        "The app update failed to install automatically. Please try restarting your browser to complete the update.",
      confirmLabel: "OK",
    });
  }

  // UI bridge was not ready or requestConfirmation failed; log to console as fallback.
  console.warn(
    "[ShadowClaw] Service worker update failed. Please restart your browser to complete the update.",
  );
}

function readUpdateIntent(): UpdateIntentState | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(UPDATE_INTENT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<UpdateIntentState>;
    if (
      typeof parsed.startedAt !== "number" ||
      typeof parsed.fallbackReloadAttempts !== "number"
    ) {
      return null;
    }

    return {
      startedAt: parsed.startedAt,
      fallbackReloadAttempts: parsed.fallbackReloadAttempts,
    };
  } catch {
    return null;
  }
}

function writeUpdateIntent(intent: UpdateIntentState) {
  try {
    globalThis.sessionStorage?.setItem(
      UPDATE_INTENT_KEY,
      JSON.stringify(intent),
    );
  } catch {
    // Ignore storage write failures (private mode / quota) and continue gracefully.
  }
}

function clearUpdateIntent() {
  try {
    globalThis.sessionStorage?.removeItem(UPDATE_INTENT_KEY);
  } catch {
    // Ignore storage removal failures and continue gracefully.
  }
}

function hasActiveUpdateIntent(): boolean {
  const intent = readUpdateIntent();
  if (!intent) {
    return false;
  }

  const isFresh = Date.now() - intent.startedAt <= UPDATE_INTENT_MAX_AGE_MS;
  if (!isFresh) {
    clearUpdateIntent();

    return false;
  }

  return true;
}

function beginUpdateIntent() {
  clearUpdateFailure();
  writeUpdateIntent({
    startedAt: Date.now(),
    fallbackReloadAttempts: 0,
  });
}

function readUpdateFailure(): UpdateFailureState | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(UPDATE_FAILURE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<UpdateFailureState>;
    if (typeof parsed.failedAt !== "number") {
      return null;
    }

    return {
      failedAt: parsed.failedAt,
    };
  } catch {
    return null;
  }
}

function writeUpdateFailure(failure: UpdateFailureState) {
  try {
    globalThis.sessionStorage?.setItem(
      UPDATE_FAILURE_KEY,
      JSON.stringify(failure),
    );
  } catch {
    // Ignore storage write failures (private mode / quota) and continue gracefully.
  }
}

function clearUpdateFailure() {
  try {
    globalThis.sessionStorage?.removeItem(UPDATE_FAILURE_KEY);
  } catch {
    // Ignore storage removal failures and continue gracefully.
  }
}

function hasRecentUpdateFailure(): boolean {
  const failure = readUpdateFailure();
  if (!failure) {
    return false;
  }

  const isFresh = Date.now() - failure.failedAt <= UPDATE_FAILURE_COOLDOWN_MS;
  if (!isFresh) {
    clearUpdateFailure();

    return false;
  }

  return true;
}

function markUpdateFailure() {
  clearUpdateIntent();
  writeUpdateFailure({ failedAt: Date.now() });
}

export function reloadCurrentPage() {
  if (didReloadAfterUpdate) {
    return;
  }

  didReloadAfterUpdate = true;
  if (pendingReloadTimeout !== null) {
    globalThis.clearTimeout(pendingReloadTimeout);
    pendingReloadTimeout = null;
  }

  const maybeLocation = (
    globalThis as {
      location?: { reload?: () => void };
    }
  ).location;

  if (typeof maybeLocation?.reload === "function") {
    maybeLocation.reload();
  }
}

async function scheduleReloadFallback() {
  if (didReloadAfterUpdate || pendingReloadTimeout !== null) {
    return;
  }

  const intent = readUpdateIntent();
  if (!intent) {
    return;
  }

  if (Date.now() - intent.startedAt > UPDATE_INTENT_MAX_AGE_MS) {
    clearUpdateIntent();

    return;
  }

  if (intent.fallbackReloadAttempts >= MAX_FALLBACK_RELOAD_ATTEMPTS) {
    markUpdateFailure();
    await notifyUpdateFailure();

    return;
  }

  writeUpdateIntent({
    ...intent,
    fallbackReloadAttempts: intent.fallbackReloadAttempts + 1,
  });

  pendingReloadTimeout = globalThis.setTimeout(() => {
    reloadCurrentPage();
  }, RELOAD_FALLBACK_TIMEOUT_MS);
}

async function applyPendingUpdate(wb: Workbox) {
  wb.messageSkipWaiting();
  await scheduleReloadFallback();
}

if ("serviceWorker" in navigator) {
  const wb = new Workbox("service-worker.js");

  wb.addEventListener("waiting", async () => {
    if (hasRecentUpdateFailure()) {
      return;
    }

    if (hasActiveUpdateIntent()) {
      await applyPendingUpdate(wb);

      return;
    }

    if (await confirmServiceWorkerUpdate()) {
      beginUpdateIntent();
      await applyPendingUpdate(wb);
    }
  });

  wb.addEventListener("controlling", () => {
    clearUpdateIntent();
    clearUpdateFailure();
    reloadCurrentPage();
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    clearUpdateIntent();
    clearUpdateFailure();
    reloadCurrentPage();
  });

  wb.register();
}
