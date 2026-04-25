import * as zip from "@zip.js/zip.js";
import { deleteAllGroupFiles } from "./deleteAllGroupFiles.js";
import { getGroupDir } from "./getGroupDir.js";
import { writeFileHandle } from "./writeFileHandle.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Restore files from a zip backup into group workspace,
 * replacing all existing files.
 */
export async function restoreAllGroupFilesFromZip(
  db: ShadowClawDatabase,
  groupId: string,
  zipBlob: Blob,
): Promise<void> {
  // First, delete all existing files
  await deleteAllGroupFiles(db, groupId);

  // Get the group directory
  const groupDir = await getGroupDir(db, groupId);

  // Create a blob reader from the zip blob
  const blobReader = new zip.BlobReader(zipBlob);
  const zipReader = new zip.ZipReader(blobReader);

  // Get all entries from the zip
  const entries = await zipReader.getEntries();

  // Extract each entry
  for (const entry of entries) {
    if (!entry.directory) {
      // Get the file blob from the zip entry
      const blob = await entry.getData(new zip.BlobWriter());

      // Create nested directories if needed
      const parts = entry.filename.split("/").filter(Boolean);
      const filename = parts.pop();
      if (!filename) {
        // Skip if no filename (directory entry)

        continue;
      }

      let currentDir = groupDir;
      for (const dirName of parts) {
        currentDir = await currentDir.getDirectoryHandle(dirName, {
          create: true,
        });
      }

      // Write the file
      const fileHandle = await currentDir.getFileHandle(filename, {
        create: true,
      });
      await writeFileHandle(fileHandle, blob);
    }
  }

  // Close the zip reader
  await zipReader.close();
}
