import { getGroupDir } from "./getGroupDir.js";
import { parsePath } from "./parsePath.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Read raw bytes from a file in a group's workspace.
 */
export async function readGroupFileBytes(
  db: ShadowClawDatabase,
  groupId: string,
  filePath: string,
): Promise<Uint8Array> {
  const groupDir = await getGroupDir(db, groupId);
  const { dirs, filename } = parsePath(filePath);

  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg);
  }

  const fileHandle = await dir.getFileHandle(filename);

  try {
    // @ts-ignore - createSyncAccessHandle only exists for OPFS handles.
    const syncHandle = await (fileHandle as any).createSyncAccessHandle();
    const size = syncHandle.getSize();
    const buf = new Uint8Array(size);

    syncHandle.read(buf, { at: 0 });
    syncHandle.close();

    return buf;
  } catch {
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();

    return new Uint8Array(arrayBuffer);
  }
}
