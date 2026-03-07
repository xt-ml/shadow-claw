// @ts-ignore
import * as zip from "zip";

import { formatDateForFilename } from "../utils.mjs";
import { addDirToZip } from "./addDirToZip.mjs";
import { getGroupDir } from "./getGroupDir.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Download entire group workspace as a zip file
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 *
 * @returns {Promise<void>}
 */
export async function downloadAllGroupFilesAsZip(db, groupId) {
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
