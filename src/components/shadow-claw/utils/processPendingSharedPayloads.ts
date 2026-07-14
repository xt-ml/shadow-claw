import { consumePendingShares } from "../../../share-target/pending-shares.js";
import { writeGroupFile } from "../../../storage/writeGroupFile.js";
import { writeGroupFileBytes } from "../../../storage/writeGroupFileBytes.js";
import { showError, showSuccess } from "../../../ui/toast.js";
import { buildSharedTextPayload } from "./buildSharedTextPayload.js";
import { resolveSharedFilesConversationId } from "./resolveSharedFilesConversationId.js";
import { sanitizeSharedFileName } from "./sanitizeSharedFileName.js";
import { showPage } from "./showPage.js";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { FileViewerStore } from "../../../stores/file-viewer.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";
import type { ShadowClaw } from "../shadow-claw.js";

export async function processPendingSharedPayloads(
  win: Window,
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
  oStore: OrchestratorStore,
  fStore: FileViewerStore,
  db: ShadowClawDatabase,
  url: URL,
): Promise<void> {
  if (!db) {
    return;
  }

  const pendingShares = await consumePendingShares(db);
  if (pendingShares.length === 0) {
    return;
  }

  try {
    const targetGroupId = await resolveSharedFilesConversationId(db, oStore);
    const savedPaths: string[] = [];

    for (let i = 0; i < pendingShares.length; i++) {
      const share = pendingShares[i];
      const baseName = `shared-${Date.now()}-${i + 1}`;

      if (share.fileBytes instanceof ArrayBuffer) {
        const preferredName =
          share.fileName ||
          (share.fileType === "application/pdf"
            ? `${baseName}.pdf`
            : `${baseName}.bin`);
        const fileName = sanitizeSharedFileName(preferredName, baseName);

        await writeGroupFileBytes(
          db,
          targetGroupId,
          fileName,
          new Uint8Array(share.fileBytes),
        );
        savedPaths.push(fileName);

        continue;
      }

      const textFileName = sanitizeSharedFileName(
        share.fileName || `${baseName}.md`,
        baseName,
      );
      const textPayload = buildSharedTextPayload(share);
      await writeGroupFile(db, targetGroupId, textFileName, textPayload);
      savedPaths.push(textFileName);
    }

    await oStore.loadFiles(db);
    showPage(shadow, shadowClaw, db, oStore, "files");

    if (savedPaths.length > 0) {
      await fStore.openFile(db, savedPaths[0], targetGroupId);
    }

    showSuccess(
      `Imported ${savedPaths.length} shared item${savedPaths.length === 1 ? "" : "s"}.`,
    );

    const currentUrl = url;
    if (currentUrl.searchParams.has("share-target")) {
      currentUrl.searchParams.delete("share-target");
      const cleaned = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
      win.history.replaceState({}, "", cleaned || "/");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showError(`Failed to import shared content: ${message}`, 6000);
  }
}
