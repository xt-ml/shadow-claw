/**
 * Post a message to the main thread
 *
 * @param {any} message
 */
export function post(message) {
  if (typeof self !== "undefined" && typeof self.postMessage === "function") {
    self.postMessage(message);
  }
}
