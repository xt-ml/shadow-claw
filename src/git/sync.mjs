import { getGroupDir } from "../storage/getGroupDir.mjs";
import { parsePath } from "../storage/parsePath.mjs";
import { ensureDir, initGitFs, repoDir } from "./git.mjs";

/**
 * Copies a repository's working tree from LightningFS to OPFS.
 * Skips the .git folder to prevent agent manipulation and save time.
 *
 * @param {import("../db/db.mjs").ShadowClawDatabase} db
 * @param {string} groupId
 * @param {string} repo - The repo name in LightningFS
 * @param {string} destPath - The path in OPFS
 * @param {boolean} [includeGit=false] - Whether to include the .git folder
 */
export async function syncLfsToOpfs(
  db,
  groupId,
  repo,
  destPath,
  includeGit = false,
) {
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

  /**
   * @param {string} lfsPath
   * @param {FileSystemDirectoryHandle} opfsDirHandle
   */
  async function copyRecursive(lfsPath, opfsDirHandle) {
    let entries;
    try {
      entries = await pfs.readdir(lfsPath);
    } catch {
      return; // Directory might not exist or be empty in LFS
    }

    // Process entries concurrently for speed
    await Promise.all(
      entries.map(async (/** @type {string} */ entry) => {
        if (!includeGit && entry === ".git") return;

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
          const writable = await fileHandle.createWritable();
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
 *
 * @param {import("../db/db.mjs").ShadowClawDatabase} db
 * @param {string} groupId
 * @param {string} srcPath - The OPFS path containing the repo files
 * @param {string} repo - The repo name in LightningFS
 * @param {boolean} [includeGit=false] - Whether to include the .git folder
 */
export async function syncOpfsToLfs(
  db,
  groupId,
  srcPath,
  repo,
  includeGit = false,
) {
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

  /**
   * @param {FileSystemDirectoryHandle} opfsDirHandle
   * @param {string} lfsPath
   */
  async function copyRecursive(opfsDirHandle, lfsPath) {
    // Collect entry names and kinds first — don't hold onto iterator handles
    // because they may cache stale file metadata
    /** @type {{ name: string, kind: string }[]} */
    const entries = [];

    // @ts-ignore
    for await (const [name, handle] of opfsDirHandle.entries()) {
      if (!includeGit && name === ".git") {
        continue;
      }

      entries.push({ name, kind: handle.kind });
    }

    const promises = [];

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
              const syncHandle = await fileHandle.createSyncAccessHandle();
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
