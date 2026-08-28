export type ParsedIframeMessage =
  | { kind: "broadcast-result"; channel: string; payload: unknown }
  | {
      kind: "storage-proxy";
      requestId: string;
      method: string;
      args: Record<string, unknown>;
    }
  | { kind: "swipe"; direction: "left" | "right" | string }
  | { kind: "iframe-resize"; height: number }
  | { kind: "file-viewer-link"; href: string };

/**
 * Parses and validates raw MessageEvent.data sent from iframes.
 */
export function parseIframeMessage(data: unknown): ParsedIframeMessage | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const payload = data as Record<string, unknown>;

  if (
    payload.type === "shadow-claw-broadcast-result" &&
    typeof payload.channel === "string"
  ) {
    return {
      kind: "broadcast-result",
      channel: payload.channel,
      payload: payload.payload,
    };
  }

  if (payload.type === "shadow-claw-storage-proxy") {
    return {
      kind: "storage-proxy",
      requestId: String(payload.requestId || ""),
      method: String(payload.method || ""),
      args: (payload.args && typeof payload.args === "object"
        ? payload.args
        : {}) as Record<string, unknown>,
    };
  }

  if (
    payload.type === "shadow-claw-swipe" &&
    typeof payload.direction === "string"
  ) {
    return {
      kind: "swipe",
      direction: payload.direction,
    };
  }

  if (
    payload.type === "shadow-claw-iframe-resize" &&
    typeof payload.height === "number"
  ) {
    return {
      kind: "iframe-resize",
      height: payload.height,
    };
  }

  if (
    payload.type === "shadow-claw-file-viewer-link" &&
    typeof payload.href === "string"
  ) {
    return {
      kind: "file-viewer-link",
      href: payload.href,
    };
  }

  return null;
}
