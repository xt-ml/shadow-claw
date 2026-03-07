/**
 * Create a tool-activity message object
 *
 * @param {string} groupId
 * @param {string} tool
 * @param {string} status
 *
 * @returns {any}
 */
export function createToolActivityMessage(groupId, tool, status) {
  return {
    type: "tool-activity",
    payload: { groupId, tool, status },
  };
}
