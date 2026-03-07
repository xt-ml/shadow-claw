import { createLogMessage } from "./createLogMessage.mjs";
import { post } from "./post.mjs";

/**
 * Log a message
 *
 * @param {string} groupId
 * @param {string} level
 * @param {string} label
 * @param {string} [message]
 */
export function log(groupId, level, label, message) {
  post(createLogMessage(groupId, level, label, message));
}
