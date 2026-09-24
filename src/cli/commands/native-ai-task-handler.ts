import type { ShadowClawDatabase } from "../../db/types.js";

/**
 * Handles incoming `request-native-ai-task` messages by invoking `core.executeNativeAiTask`
 * and resolving/rejecting the pending global promise resolver.
 */
export function handleNativeAiTaskMessage(
  core: any,
  db: ShadowClawDatabase,
  payload: any,
): Promise<void> | void {
  if (!payload || typeof core?.executeNativeAiTask !== "function") {
    return;
  }

  const { id, groupId: taskGroupId, taskType, input } = payload;

  return core
    .executeNativeAiTask({
      taskType,
      input,
      groupId: taskGroupId,
      db,
    })
    .then((res: unknown) => {
      const resolvers = (globalThis as any).pendingNativeAiResolvers;
      if (resolvers && resolvers[id]) {
        resolvers[id].resolve(res);
        delete resolvers[id];
      }
    })
    .catch((err: unknown) => {
      const resolvers = (globalThis as any).pendingNativeAiResolvers;
      if (resolvers && resolvers[id]) {
        resolvers[id].reject(err);
        delete resolvers[id];
      }
    });
}
