// @ts-ignore
import * as zip from "zip";
import { deleteAllGroupFiles } from "./deleteAllGroupFiles.mjs";
import { getGroupDir } from "./getGroupDir.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Restore files from a zip backup into group workspace,
 * replacing all existing files.
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 * @param {Blob} zipBlob
 *
 * @returns {Promise<void>}
 */
export async function restoreAllGroupFilesFromZip(db, groupId, zipBlob) {
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

      // @ts-ignore - createWritable is a newer File System Access API method
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    }
  }

  // Close the zip reader
  await zipReader.close();
}
