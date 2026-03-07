// @ts-ignore
import * as zip from "zip";

import { addDirToZip } from "./addDirToZip.mjs";
import { getGroupDir } from "./getGroupDir.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Create a zip file of a directory and trigger download
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 * @param {string} dirPath
 *
 * @returns {Promise<void>}
 */
export async function downloadGroupDirectoryAsZip(db, groupId, dirPath) {
  const groupDir = await getGroupDir(db, groupId);
  const dirName = dirPath.replace(/\/$/, "").split("/").pop() || "archive";

  let dir = groupDir;
  if (dirPath && dirPath !== ".") {
    const parts = dirPath
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/$/, "")
      .split("/")
      .filter(Boolean);

    for (const seg of parts) {
      dir = await dir.getDirectoryHandle(seg);
    }
  }

  // Create a blob writer and zip writer
  const blobWriter = new zip.BlobWriter("application/zip");
  const zipWriter = new zip.ZipWriter(blobWriter);

  // Add all files and subdirectories to the zip
  await addDirToZip(zipWriter, dir);

  // Close the zip writer to finalize
  await zipWriter.close();

  // Get the blob
  const blob = await blobWriter.getData();

  // Create a download link and trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${dirName}.zip`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
