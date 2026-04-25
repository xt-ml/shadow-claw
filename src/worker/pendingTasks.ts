/**
 * Map of pending task callbacks, keyed by groupId
 */
export const pendingTasks = new Map<string, (tasks: any[]) => void>();
