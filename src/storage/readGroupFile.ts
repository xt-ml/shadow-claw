import { getGroupDir } from "./getGroupDir.js";
import { parsePath } from "./parsePath.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Read a file from a group's workspace.
 */
export async function readGroupFile(
  db: ShadowClawDatabase,
  groupId: string,
  filePath: string,
): Promise<string> {
  const groupDir = await getGroupDir(db, groupId);
  const { dirs, filename } = parsePath(filePath);

  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg);
  }

  // Re-acquire file handle and file object to force filesystem re-stat
  const fileHandle = await dir.getFileHandle(filename);

  try {
    const syncHandle = await (fileHandle as any).createSyncAccessHandle();
    const size = syncHandle.getSize();
    const buf = new Uint8Array(size);

    syncHandle.read(buf, { at: 0 });
    syncHandle.close();

    return new TextDecoder("utf-8").decode(buf);
  } catch {
    // Not OPFS or not in a Worker — use File System Access API path
    const file = await fileHandle.getFile();

    return file.text();
  }
}
