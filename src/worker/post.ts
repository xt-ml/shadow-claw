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
 * Post a message to the main thread
 */
export function post(message: any): void {
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
