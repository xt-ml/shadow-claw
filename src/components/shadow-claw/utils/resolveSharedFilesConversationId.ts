import type { ShadowClawDatabase } from "../../../db/db.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";

export async function resolveSharedFilesConversationId(
  db: ShadowClawDatabase,
  oStore: OrchestratorStore,
): Promise<string> {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const isoDate = `${year}-${month}-${day}`;
  const conversationName = `Shared Files ${isoDate}`;
  const existing = oStore.groups.find(
    (group) => group.name === conversationName,
  );

  if (existing) {
    await oStore.switchConversation(db, existing.groupId);

    return existing.groupId;
  }

  const group = await oStore.createConversation(db, conversationName);

  return group.groupId;
}
