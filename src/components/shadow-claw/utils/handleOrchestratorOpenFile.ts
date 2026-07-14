import { OpenFilePayload } from "../../../subsystems/worker/types.js";
import { showError } from "../../../ui/toast.js";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { FileViewerStore } from "../../../stores/file-viewer.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";

export async function handleOrchestratorOpenFile(
  db: ShadowClawDatabase,
  oStore: OrchestratorStore,
  fStore: FileViewerStore,
  payload: OpenFilePayload,
) {
  const path = payload.path;
  const groupId = payload.groupId || oStore.activeGroupId;
  const maxRetries = 3;

  if (!path || !db) {
    return;
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await fStore.openFile(db, path, groupId);

      return;
    } catch (err) {
      const isNotFound =
        err instanceof DOMException && err.name === "NotFoundError";

      if (attempt < maxRetries && isNotFound) {
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));

        continue;
      }

      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to open file from tool: ${message}`, 5000);
    }
  }
}
