import * as zip from "@zip.js/zip.js";

/**
 * Recursively add a directory to zip writer
 *
 * @private
 */
export async function addDirToZip(
  zipWriter: any,
  dirHandle: FileSystemDirectoryHandle,
  zipPath: string = "",
): Promise<void> {
  // @ts-ignore - entries() is a newer File System Access API iterator method
  for await (const [name, handle] of (dirHandle as any).entries()) {
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
