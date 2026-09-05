/**
 * ShadowClaw — App Lifecycle & Connection Health Management
 *
 * Listens for mobile sleep / wake, tab switching, and network changes:
 * - visibilitychange: detects when the app/tab is backgrounded or brought back to foreground.
 *   If the app was backgrounded for longer than minSleepDurationMs (default: 1000ms),
 *   it indicates the device went to sleep or user switched away, requiring forced reconnection.
 * - pageshow: handles bfcache restoration and page reveal.
 * - focus: handles window/tab focus.
 * - online: handles network connectivity resumption.
 *
 * Coalesces rapid succession of resume events via a debounce window (default: 250ms).
 */

export interface AppLifecycleOptions {
  debounceMs?: number;
  minSleepDurationMs?: number;
}

export interface MinimalOrchestrator {
  ensureAllConnections(options?: { force?: boolean }): Promise<void>;
}

export function setupAppLifecycle(
  win: Window,
  doc: Document,
  orchestrator: MinimalOrchestrator,
  options: AppLifecycleOptions = {},
): () => void {
  const debounceMs = options.debounceMs ?? 250;
  const minSleepDurationMs = options.minSleepDurationMs ?? 1000;

  let lastHiddenTime = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingForce = false;

  const triggerReconnect = (force: boolean) => {
    if (force) {
      pendingForce = true;
    }

    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const shouldForce = pendingForce;
      pendingForce = false;
      void orchestrator.ensureAllConnections({ force: shouldForce });
    }, debounceMs);
  };

  const cancelPendingReconnect = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    pendingForce = false;
  };

  const onVisibilityChange = () => {
    if (doc.visibilityState === "hidden") {
      lastHiddenTime = Date.now();
      cancelPendingReconnect();
    } else if (doc.visibilityState === "visible") {
      const now = Date.now();
      const wasAsleep =
        lastHiddenTime > 0 && now - lastHiddenTime >= minSleepDurationMs;
      triggerReconnect(wasAsleep);
    }
  };

  const onPageShow = (event?: PageTransitionEvent) => {
    const isPersisted = Boolean(event && event.persisted);
    triggerReconnect(isPersisted || doc.visibilityState === "visible");
  };

  const onFocus = () => {
    if (doc.visibilityState === "visible") {
      triggerReconnect(false);
    }
  };

  const onOnline = () => {
    triggerReconnect(true);
  };

  doc.addEventListener("visibilitychange", onVisibilityChange);
  win.addEventListener("pageshow", onPageShow);
  win.addEventListener("focus", onFocus);
  win.addEventListener("online", onOnline);

  return () => {
    cancelPendingReconnect();
    doc.removeEventListener("visibilitychange", onVisibilityChange);
    win.removeEventListener("pageshow", onPageShow);
    win.removeEventListener("focus", onFocus);
    win.removeEventListener("online", onOnline);
  };
}
