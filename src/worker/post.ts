/** post handler type */
export type PostHandler = (message: any) => void;

let postHandler: PostHandler | null = null;

/**
 * Override post routing, useful when worker utilities are reused on main thread.
 */
export function setPostHandler(handler: PostHandler | null): void {
  postHandler = handler;
}

/**
 * Per-invocation collectors keyed by subagent groupId.
 * When a subagent is running, its messages are captured here instead of
 * being forwarded to the main thread (which would create spurious UI messages).
 */
const subagentCollectors = new Map<string, any[]>();

/**
 * Register a collector array for a subagent groupId.
 * While registered, any post() call whose payload.groupId matches will
 * be appended to the collector instead of sent to postMessage.
 */
export function registerSubagentCollector(
  groupId: string,
  collector: any[],
): void {
  subagentCollectors.set(groupId, collector);
}

/**
 * Unregister the collector for a subagent groupId.
 * After this call, messages for that groupId flow normally again.
 */
export function unregisterSubagentCollector(groupId: string): void {
  subagentCollectors.delete(groupId);
}

/**
 * Post a message to the main thread
 */
export function post(message: any): void {
  // Route subagent messages to their collector instead of the main thread
  const gid = message?.payload?.groupId as string | undefined;
  if (gid && subagentCollectors.has(gid)) {
    subagentCollectors.get(gid)!.push(message);

    return;
  }

  if (postHandler) {
    postHandler(message);

    return;
  }

  if (
    typeof (self as any) !== "undefined" &&
    typeof (self as any).postMessage === "function"
  ) {
    (self as any).postMessage(message);
  }
}
