/** @type {((message: any) => void) | null} */
let postHandler = null;

/**
 * Override post routing, useful when worker utilities are reused on main thread.
 *
 * @param {((message: any) => void) | null} handler
 */
export function setPostHandler(handler) {
  postHandler = handler;
}

/**
 * Post a message to the main thread
 *
 * @param {any} message
 */
export function post(message) {
  if (postHandler) {
    postHandler(message);
    return;
  }

  if (typeof self !== "undefined" && typeof self.postMessage === "function") {
    self.postMessage(message);
  }
}
