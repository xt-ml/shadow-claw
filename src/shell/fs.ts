import { InMemoryFs } from "just-bash";
import { readGroupFile } from "../storage/readGroupFile.js";
import { writeGroupFile } from "../storage/writeGroupFile.js";
import { deleteGroupFile } from "../storage/deleteGroupFile.js";
import { listGroupFiles } from "../storage/listGroupFiles.js";
import type { ShadowClawDatabase } from "../types.js";

export class ShadowClawFileSystem extends InMemoryFs {
  private db: ShadowClawDatabase;
  private groupId: string;
  private workspacePrefix: string;

  constructor(
    db: ShadowClawDatabase,
    groupId: string,
    files: Record<string, any>,
    workspacePrefix: string = "/home/user",
  ) {
    super(files);
    this.db = db;
    this.groupId = groupId;
    this.workspacePrefix = workspacePrefix;
  }

  /**
   * Map from absolute fs path to database path.
   */
  private _toDbPath(path: string): string | null {
    if (path.startsWith(this.workspacePrefix + "/")) {
      return path.slice(this.workspacePrefix.length + 1);
    } else if (path === this.workspacePrefix) {
      return "";
    }

    return null;
  }

  // Hook all methods that mutate file system

  override async writeFile(
    path: string,
    content: string | Uint8Array,
    options?: any,
  ): Promise<void> {
    await super.writeFile(path, content, options);

    // Read final state from in-memory and write back to DB
    const dbPath = this._toDbPath(path);
    if (dbPath !== null) {
      const finalContent = await super.readFile(path);
      await writeGroupFile(this.db, this.groupId, dbPath, finalContent);
    }
  }

  override async appendFile(
    path: string,
    content: string | Uint8Array,
  ): Promise<void> {
    await super.appendFile(path, content);

    const dbPath = this._toDbPath(path);
    if (dbPath !== null) {
      const finalContent = await super.readFile(path);
      await writeGroupFile(this.db, this.groupId, dbPath, finalContent);
    }
  }

  override async rm(path: string, options?: any): Promise<void> {
    await super.rm(path, options);

    const dbPath = this._toDbPath(path);
    if (dbPath !== null) {
      try {
        // Best-effort removal of corresponding storage file.
        // OPFS handles directories, but we primarily care about saving/deleting files.
        // deleteGroupFile parses the path and removes the entry inside the directory.
        await deleteGroupFile(this.db, this.groupId, dbPath);
      } catch {
        // Ignore if it was a directory or didn't exist
      }
    }
  }

  // cp, mv, etc., might not call writeFile internally in InMemoryFs,
  // so we hook them just in case to sync the destination.

  override async cp(src: string, dest: string, options?: any): Promise<void> {
    await super.cp(src, dest, options);

    // dest should now exist in memory
    const dbDest = this._toDbPath(dest);
    if (dbDest !== null) {
      try {
        const stats = await super.stat(dest);
        if (!stats.isDirectory) {
          const finalContent = await super.readFile(dest);
          await writeGroupFile(this.db, this.groupId, dbDest, finalContent);
        }
      } catch {}
    }
  }

  override async mv(src: string, dest: string): Promise<void> {
    await super.mv(src, dest);

    const dbDest = this._toDbPath(dest);
    if (dbDest !== null) {
      try {
        const stats = await super.stat(dest);
        if (!stats.isDirectory) {
          const finalContent = await super.readFile(dest);
          await writeGroupFile(this.db, this.groupId, dbDest, finalContent);
        }
      } catch {}
    }

    const dbSrc = this._toDbPath(src);
    if (dbSrc !== null) {
      try {
        await deleteGroupFile(this.db, this.groupId, dbSrc);
      } catch {}
    }
  }
}

/**
 * Initialize a file system instance loaded with the workspace's files.
 */
export async function createFileSystem(
  db: ShadowClawDatabase,
  groupId: string,
): Promise<ShadowClawFileSystem> {
  const files = {};
  const workspacePrefix = "/home/user";

  async function traverse(dirPath: string): Promise<void> {
    const entries = await listGroupFiles(db, groupId, dirPath);
    for (const entry of entries) {
      if (entry.endsWith("/")) {
        const dirName = entry.slice(0, -1);
        const childPath = dirPath === "." ? dirName : `${dirPath}/${dirName}`;
        await traverse(childPath);
      } else {
        const filePath = dirPath === "." ? entry : `${dirPath}/${entry}`;
        const fsPath = `${workspacePrefix}/${filePath}`;
        files[fsPath] = async () => {
          try {
            return await readGroupFile(db, groupId, filePath);
          } catch {
            return "";
          }
        };
      }
    }
  }

  await traverse(".");

  return new ShadowClawFileSystem(db, groupId, files, workspacePrefix);
}
