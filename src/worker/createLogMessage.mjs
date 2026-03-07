/**
 * Create a thinking-log message object
 *
 * @param {string} groupId
 * @param {string} level
 * @param {string} label
 * @param {string} [message]
 *
 * @returns {any}
 */
export function createLogMessage(groupId, level, label, message) {
  return {
    type: "thinking-log",
    payload: { groupId, level, timestamp: Date.now(), label, message },
  };
}
