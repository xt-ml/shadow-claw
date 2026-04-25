import { getGroupDir } from "../storage/getGroupDir.js";
import { parsePath } from "../storage/parsePath.js";
import { ensureDir, initGitFs, repoDir } from "./git.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Copies a repository's working tree from LightningFS to OPFS.
 * Skips the .git folder to prevent agent manipulation and save time.
 */
export async function syncLfsToOpfs(
  db: ShadowClawDatabase,
  groupId: string,
  repo: string,
  destPath: string,
  includeGit: boolean = false,
): Promise<void> {
  const { pfs } = await initGitFs();
  const groupDir = await getGroupDir(db, groupId);
  const { dirs: destDirs, filename: destFilename } = parsePath(destPath);

  // Resolve OPFS destination directory
  let targetDir = groupDir;
  for (const d of destDirs) {
    targetDir = await targetDir.getDirectoryHandle(d, { create: true });
  }

  if (destFilename) {
    targetDir = await targetDir.getDirectoryHandle(destFilename, {
      create: true,
    });
  }

  const lfsRepoDir = repoDir(repo);

  async function copyRecursive(
    lfsPath: string,
    opfsDirHandle: FileSystemDirectoryHandle,
  ): Promise<void> {
    let entries;
    try {
      entries = await pfs.readdir(lfsPath);
    } catch {
      return; // Directory might not exist or be empty in LFS
    }

    // Process entries concurrently for speed
    await Promise.all(
      entries.map(async (entry: string) => {
        if (!includeGit && entry === ".git") {
          return;
        }

        const fullPath = `${lfsPath}/${entry}`;
        const stat = await pfs.stat(fullPath);

        if (stat.isDirectory()) {
          const subDirHandle = await opfsDirHandle.getDirectoryHandle(entry, {
            create: true,
          });

          await copyRecursive(fullPath, subDirHandle);
        } else {
          const content = await pfs.readFile(fullPath);
          const fileHandle = await opfsDirHandle.getFileHandle(entry, {
            create: true,
          });

          // @ts-ignore
          const writable = await (fileHandle as any).createWritable();
          await writable.write(content);
          await writable.close();
        }
      }),
    );
  }

  await copyRecursive(lfsRepoDir, targetDir);
}

/**
 * Copies a working tree from OPFS back to LightningFS so git commands
 * (like commit or status) see the latest files modified by the agent.
 *
 * Supports two storage backends:
 * - True OPFS: uses createSyncAccessHandle() for guaranteed fresh reads
 * - File System Access API (showDirectoryPicker): re-acquires file handles
 *   from the parent directory so Chrome re-stats the underlying filesystem
 */
export async function syncOpfsToLfs(
  db: ShadowClawDatabase,
  groupId: string,
  srcPath: string,
  repo: string,
  includeGit: boolean = false,
): Promise<void> {
  const { pfs } = await initGitFs();
  const groupDir = await getGroupDir(db, groupId);
  const { dirs: srcDirs, filename: srcFilename } = parsePath(srcPath);

  // Resolve OPFS source directory
  let sourceDir;
  try {
    sourceDir = groupDir;
    for (const d of srcDirs) {
      sourceDir = await sourceDir.getDirectoryHandle(d, { create: false });
    }

    if (srcFilename) {
      sourceDir = await sourceDir.getDirectoryHandle(srcFilename, {
        create: false,
      });
    }
  } catch {
    throw new Error(`OPFS path "${srcPath}" not found. Cannot sync to Git.`);
  }

  const lfsRepoDir = repoDir(repo);
  await ensureDir(pfs, lfsRepoDir);

  async function copyRecursive(
    opfsDirHandle: FileSystemDirectoryHandle,
    lfsPath: string,
  ): Promise<void> {
    // Collect entry names and kinds first — don't hold onto iterator handles
    // because they may cache stale file metadata
    const entries: { name: string; kind: "file" | "directory" }[] = [];

    // @ts-ignore
    for await (const [name, handle] of (opfsDirHandle as any).entries()) {
      if (!includeGit && name === ".git") {
        continue;
      }

      entries.push({ name, kind: handle.kind as "file" | "directory" });
    }

    const promises: Promise<void>[] = [];

    for (const { name, kind } of entries) {
      const fullPath = `${lfsPath}/${name}`;

      if (kind === "directory") {
        promises.push(
          (async () => {
            // Re-acquire directory handle for fresh reference
            const dirHandle = await opfsDirHandle.getDirectoryHandle(name, {
              create: false,
            });

            await ensureDir(pfs, fullPath);
            await copyRecursive(dirHandle, fullPath);
          })(),
        );
      } else {
        promises.push(
          (async () => {
            // Re-acquire file handle to force filesystem re-stat
            const fileHandle = await opfsDirHandle.getFileHandle(name);

            // Try OPFS-only createSyncAccessHandle for guaranteed fresh read
            try {
              // @ts-ignore
              const syncHandle = await (
                fileHandle as any
              ).createSyncAccessHandle();
              const size = syncHandle.getSize();
              const buf = new Uint8Array(size);

              syncHandle.read(buf, { at: 0 });
              syncHandle.close();

              await pfs.writeFile(fullPath, buf);
            } catch {
              // Not OPFS — use File System Access API path
              const file = await fileHandle.getFile();
              const buffer = await file.arrayBuffer();

              await pfs.writeFile(fullPath, new Uint8Array(buffer));
            }
          })(),
        );
      }
    }

    await Promise.all(promises);
  }

  await copyRecursive(sourceDir, lfsRepoDir);
}
