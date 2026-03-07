// @ts-ignore
import * as zip from "zip";

/**
 * Recursively add a directory to zip writer
 *
 * @private
 *
 * @param {any} zipWriter
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} zipPath
 *
 * @returns {Promise<void>}
 */
export async function addDirToZip(zipWriter, dirHandle, zipPath = "") {
  // @ts-ignore - entries() is a newer File System Access API iterator method
  for await (const [name, handle] of dirHandle.entries()) {
    const fullPath = zipPath ? `${zipPath}/${name}` : name;
    if (handle.kind === "directory") {
      // Recursively add subdirectory
      await addDirToZip(zipWriter, handle, fullPath);
    } else {
      // Add file to zip
      const file = await handle.getFile();

      await zipWriter.add(fullPath, new zip.BlobReader(file));
    }
  }
}
