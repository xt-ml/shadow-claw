import * as zip from "@zip.js/zip.js";
import { addDirToZip } from "./addDirToZip.js";
import { getGroupDir } from "./getGroupDir.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Create a zip file of a directory and trigger download
 */
export async function downloadGroupDirectoryAsZip(
  db: ShadowClawDatabase,
  groupId: string,
  dirPath: string,
): Promise<void> {
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
