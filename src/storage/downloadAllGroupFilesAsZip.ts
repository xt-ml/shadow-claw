import * as zip from "@zip.js/zip.js";
import { formatDateForFilename } from "../utils.js";
import { addDirToZip } from "./addDirToZip.js";
import { getGroupDir } from "./getGroupDir.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Download entire group workspace as a zip file
 */
export async function downloadAllGroupFilesAsZip(
  db: ShadowClawDatabase,
  groupId: string,
): Promise<void> {
  const groupDir = await getGroupDir(db, groupId);

  // Create a blob writer and zip writer
  const blobWriter = new zip.BlobWriter("application/zip");
  const zipWriter = new zip.ZipWriter(blobWriter);

  // Add all files and subdirectories to the zip
  await addDirToZip(zipWriter, groupDir);

  // Close the zip writer to finalize
  await zipWriter.close();

  // Get the blob
  const blob = await blobWriter.getData();

  // Create a download link and trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `shadowclaw-backup-${formatDateForFilename()}.zip`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
