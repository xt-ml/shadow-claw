import { post } from "./post.js";

const ONE_MINUTE_MS = 60_000;

export interface RateLimitConfig {
  callsPerMinute: number;
  autoAdapt: boolean;
}

interface ProviderRateLimitState {
  recentCalls: number[];
  nextAllowedAt: number;
  remoteLimit: number | null;
  remoteRemaining: number | null;
  remoteResetAt: number | null;
}

const stateByProvider = new Map<string, ProviderRateLimitState>();

function getState(providerId: string): ProviderRateLimitState {
  const existing = stateByProvider.get(providerId);
  if (existing) {
    return existing;
  }

  const created: ProviderRateLimitState = {
    recentCalls: [],
    nextAllowedAt: 0,
    remoteLimit: null,
    remoteRemaining: null,
    remoteResetAt: null,
  };

  stateByProvider.set(providerId, created);

  return created;
}

function nowMs(): number {
  return Date.now();
}

function parseHeaderNumber(raw: string | null): number | null {
  if (!raw) {
    return null;
  }

  const value = Number(raw.trim());
  if (!Number.isFinite(value)) {
    return null;
  }

  return value;
}

function parseRetryAfterMs(retryAfter: string | null): number | null {
  if (!retryAfter) {
    return null;
  }

  const trimmed = retryAfter.trim();
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    if (numeric <= 0) {
      return null;
    }

    return Math.round(numeric * 1000);
  }

  const dateMs = Date.parse(trimmed);
  if (!Number.isFinite(dateMs)) {
    return null;
  }

  const delta = dateMs - nowMs();

  return delta > 0 ? delta : null;
}

function parseResetAtMs(resetHeader: string | null): number | null {
  const numeric = parseHeaderNumber(resetHeader);
  if (numeric === null || numeric <= 0) {
    return null;
  }

  // 13-digit epoch milliseconds
  if (numeric >= 1_000_000_000_000) {
    return Math.round(numeric);
  }

  // 10-digit epoch seconds
  if (numeric >= 1_000_000_000) {
    return Math.round(numeric * 1000);
  }

  // Otherwise treat as delta seconds from now.

  return nowMs() + Math.round(numeric * 1000);
}

async function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      signal?.removeEventListener("abort", onAbort);
    };

    if (signal?.aborted) {
      onAbort();

      return;
    }

    signal?.addEventListener("abort", onAbort);
  });
}

function computeManualWaitMs(
  state: ProviderRateLimitState,
  callsPerMinute: number,
): number {
  if (!Number.isFinite(callsPerMinute) || callsPerMinute <= 0) {
    return 0;
  }

  const now = nowMs();
  state.recentCalls = state.recentCalls.filter(
    (ts) => now - ts < ONE_MINUTE_MS,
  );

  if (state.recentCalls.length < callsPerMinute) {
    return 0;
  }

  const oldest = state.recentCalls[0] || now;

  return Math.max(0, ONE_MINUTE_MS - (now - oldest));
}

function computeAutoWaitMs(state: ProviderRateLimitState): number {
  const now = nowMs();
  let waitMs = 0;

  if (state.nextAllowedAt > now) {
    waitMs = Math.max(waitMs, state.nextAllowedAt - now);
  }

  if (
    state.remoteRemaining !== null &&
    state.remoteRemaining <= 0 &&
    state.remoteResetAt !== null &&
    state.remoteResetAt > now
  ) {
    waitMs = Math.max(waitMs, state.remoteResetAt - now);
  }

  return waitMs;
}

export async function waitForRateLimitSlot(
  providerId: string,
  groupId: string,
  config: RateLimitConfig,
  signal?: AbortSignal,
): Promise<void> {
  const state = getState(providerId);

  while (true) {
    const manualWait = computeManualWaitMs(state, config.callsPerMinute);
    const autoWait = config.autoAdapt ? computeAutoWaitMs(state) : 0;
    const waitMs = Math.max(manualWait, autoWait);

    if (waitMs <= 0) {
      const now = nowMs();
      if (config.callsPerMinute > 0) {
        state.recentCalls.push(now);
      }

      if (
        config.autoAdapt &&
        state.remoteRemaining !== null &&
        state.remoteRemaining > 0 &&
        state.remoteResetAt !== null &&
        state.remoteResetAt > now
      ) {
        const msLeft = state.remoteResetAt - now;
        const slotsLeft = Math.max(1, state.remoteRemaining);
        const interval = Math.ceil(msLeft / slotsLeft);
        state.nextAllowedAt = Math.max(state.nextAllowedAt, now + interval);
      }

      return;
    }

    if (waitMs >= 1000) {
      post({
        type: "thinking-log",
        payload: {
          groupId,
          level: "info",
          label: "Rate limiter",
          message: `Waiting ${Math.ceil(waitMs / 1000)}s before next provider call to avoid 429s.`,
          timestamp: Date.now(),
        },
      });
    }

    await waitWithAbort(waitMs, signal);
  }
}

type HeaderReader = {
  get(name: string): string | null;
};

export function updateRateLimitFromHeaders(
  providerId: string,
  headers: HeaderReader | null | undefined,
  config: RateLimitConfig,
): void {
  if (!config.autoAdapt) {
    return;
  }

  if (!headers || typeof headers.get !== "function") {
    return;
  }

  const state = getState(providerId);
  const now = nowMs();

  const limit = parseHeaderNumber(headers.get("x-ratelimit-limit"));
  const remaining = parseHeaderNumber(headers.get("x-ratelimit-remaining"));
  const resetAt = parseResetAtMs(headers.get("x-ratelimit-reset"));

  if (limit !== null) {
    state.remoteLimit = Math.max(0, Math.floor(limit));
  }

  if (remaining !== null) {
    state.remoteRemaining = Math.max(0, Math.floor(remaining));
  }

  if (resetAt !== null) {
    state.remoteResetAt = resetAt;
  }

  const retryAfterMs = parseRetryAfterMs(headers.get("retry-after"));
  if (retryAfterMs !== null) {
    state.nextAllowedAt = Math.max(state.nextAllowedAt, now + retryAfterMs);
  }

  if (
    state.remoteRemaining !== null &&
    state.remoteRemaining <= 0 &&
    state.remoteResetAt !== null &&
    state.remoteResetAt > now
  ) {
    state.nextAllowedAt = Math.max(state.nextAllowedAt, state.remoteResetAt);
  }
}
