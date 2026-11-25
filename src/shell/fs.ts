import * as justBashNamespace from "just-bash";
import { InMemoryFs } from "just-bash";
import { readGroupFileBytes } from "../storage/read-group-file-bytes.js";
import { writeGroupFile } from "../storage/write-group-file.js";
import { deleteGroupFile } from "../storage/delete-group-file.js";
import { deleteGroupDirectory } from "../storage/delete-group-directory.js";
import { listGroupFiles } from "../storage/list-group-files.js";
import { createGroupDirectory } from "../storage/create-group-directory.js";
import type { ShadowClawDatabase } from "../db/types.js";

// Look up DefenseInDepthBox dynamically so browser bundles (where it is not
// exported) compile cleanly while Node runtimes still run storage hooks outside
// the untrusted async defense context.
const DEFENSE_BOX_EXPORT = "DefenseInDepthBox";

async function runHostStorageOp<T>(fn: () => Promise<T>): Promise<T> {
  const ns = justBashNamespace as Record<string, any>;
  const box = ns[DEFENSE_BOX_EXPORT] ?? ns.default?.[DEFENSE_BOX_EXPORT];
  if (box && typeof box.runTrustedAsync === "function") {
    return await box.runTrustedAsync(fn);
  }

  return await fn();
}

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

  override async appendFile(
    path: string,
    content: string | Uint8Array,
    options?: any,
  ): Promise<void> {
    const normalized = this._normalizePath(path);
    await super.appendFile(path, content, options);

    const dbPath = this._toDbPath(normalized);
    if (dbPath !== null && dbPath !== "") {
      const finalContent = await this._readPathContent(normalized);
      await runHostStorageOp(() =>
        writeGroupFile(this.db, this.groupId, dbPath, finalContent),
      );
    }
  }

  // cp, mv, link, createExclusive, etc. may mutate InMemoryFs directly without
  // routing through writeFile/mkdir, so hook them to keep workspace storage in sync.

  override async cp(src: string, dest: string, options?: any): Promise<void> {
    const normalizedSrc = this._normalizePath(src);
    const normalizedDest = this._normalizePath(dest);
    let srcIsDir = false;
    let destIsDir = false;
    try {
      srcIsDir = this._isDirectoryStat(await super.stat(normalizedSrc));
    } catch {}
    try {
      destIsDir = this._isDirectoryStat(await super.stat(normalizedDest));
    } catch {}

    let effectiveDest = normalizedDest;
    if (!srcIsDir && destIsDir) {
      const base = this._basename(normalizedSrc);
      if (base) {
        effectiveDest = this._joinPath(normalizedDest, base);
      }
    }

    await super.cp(src, effectiveDest, options);

    const dbDest = this._toDbPath(effectiveDest);
    if (dbDest !== null && dbDest !== "") {
      try {
        const stats = await super.stat(effectiveDest);
        if (!this._isDirectoryStat(stats)) {
          const finalContent = await this._readPathContent(effectiveDest);
          await runHostStorageOp(() =>
            writeGroupFile(this.db, this.groupId, dbDest, finalContent),
          );
        }
      } catch {}
    }
  }

  async createExclusive(
    path: string,
    options: { mode: number; directory?: boolean },
  ): Promise<void> {
    const normalized = this._normalizePath(path);
    const superCreateExclusive = (InMemoryFs.prototype as any).createExclusive;
    if (typeof superCreateExclusive === "function") {
      await superCreateExclusive.call(this, path, options);
    } else {
      if (await super.exists(normalized)) {
        const op = options.directory ? "mkdir" : "open";
        throw new Error(`EEXIST: file already exists, ${op} '${path}'`);
      }

      if (options.directory) {
        await super.mkdir(normalized);
      } else {
        await super.writeFile(normalized, new Uint8Array(0));
      }

      if (typeof super.chmod === "function") {
        await super.chmod(normalized, options.mode);
      }
    }

    const dbPath = this._toDbPath(normalized);
    if (dbPath !== null && dbPath !== "") {
      if (options.directory) {
        await runHostStorageOp(() =>
          createGroupDirectory(this.db, this.groupId, dbPath),
        );
      } else {
        const finalContent = await this._readPathContent(normalized);
        await runHostStorageOp(() =>
          writeGroupFile(this.db, this.groupId, dbPath, finalContent),
        );
      }
    }
  }

  override async link(existingPath: string, newPath: string): Promise<void> {
    const normalizedDest = this._normalizePath(newPath);
    await super.link(existingPath, newPath);

    const dbPath = this._toDbPath(normalizedDest);
    if (dbPath !== null && dbPath !== "") {
      const finalContent = await this._readPathContent(normalizedDest);
      await runHostStorageOp(() =>
        writeGroupFile(this.db, this.groupId, dbPath, finalContent),
      );
    }
  }

  override async mkdir(path: string, options?: any): Promise<void> {
    const normalized = this._normalizePath(path);
    await super.mkdir(path, options);

    const dbPath = this._toDbPath(normalized);
    if (dbPath !== null && dbPath !== "") {
      await runHostStorageOp(() =>
        createGroupDirectory(this.db, this.groupId, dbPath),
      );
    }
  }

  override async mv(src: string, dest: string): Promise<void> {
    const normalizedSrc = this._normalizePath(src);
    const normalizedDest = this._normalizePath(dest);

    let srcWasDir = false;
    let destExistedAsDir = false;
    try {
      srcWasDir = this._isDirectoryStat(await super.stat(normalizedSrc));
    } catch {}
    try {
      destExistedAsDir = this._isDirectoryStat(
        await super.stat(normalizedDest),
      );
    } catch {}

    let effectiveDest = normalizedDest;
    if (destExistedAsDir && normalizedDest !== normalizedSrc) {
      const sourceName = this._basename(normalizedSrc);
      if (sourceName) {
        effectiveDest = this._joinPath(normalizedDest, sourceName);
      }
    }

    await super.mv(src, effectiveDest);

    let persistedDestInWorkspace = false;
    const dbDest = this._toDbPath(effectiveDest);
    const dbSrc = this._toDbPath(normalizedSrc);

    if (srcWasDir) {
      if (dbDest !== null) {
        try {
          const finalStats = await super.stat(effectiveDest);
          if (this._isDirectoryStat(finalStats)) {
            if (dbDest !== "") {
              await runHostStorageOp(() =>
                createGroupDirectory(this.db, this.groupId, dbDest),
              );
            }
            persistedDestInWorkspace = true;
          }
        } catch {}
      }

      if (dbSrc !== null && dbSrc !== "") {
        try {
          if (dbDest === null || persistedDestInWorkspace) {
            await runHostStorageOp(() =>
              deleteGroupDirectory(this.db, this.groupId, dbSrc),
            );
          }
        } catch {}
      }
      return;
    }

    if (dbDest !== null && dbDest !== "") {
      try {
        const finalStats = await super.stat(effectiveDest);
        if (!this._isDirectoryStat(finalStats)) {
          const finalContent = await this._readPathContent(effectiveDest);
          await runHostStorageOp(() =>
            writeGroupFile(this.db, this.groupId, dbDest, finalContent),
          );
          persistedDestInWorkspace = true;
        }
      } catch {}
    }

    if (dbSrc !== null && dbSrc !== "") {
      try {
        if (dbDest === null || persistedDestInWorkspace) {
          await runHostStorageOp(() =>
            deleteGroupFile(this.db, this.groupId, dbSrc),
          );
        }
      } catch {}
    }
  }

  override async rm(path: string, options?: any): Promise<void> {
    const normalized = this._normalizePath(path);
    let wasDirectory = false;
    try {
      wasDirectory = this._isDirectoryStat(await super.stat(normalized));
    } catch {}

    await super.rm(path, options);

    const dbPath = this._toDbPath(normalized);
    if (dbPath !== null && dbPath !== "") {
      try {
        if (wasDirectory) {
          await runHostStorageOp(() =>
            deleteGroupDirectory(this.db, this.groupId, dbPath),
          );
        } else {
          await runHostStorageOp(() =>
            deleteGroupFile(this.db, this.groupId, dbPath),
          );
        }
      } catch {
        // Ignore if entry did not exist in persistent storage
      }
    }
  }

  override async writeFile(
    path: string,
    content: string | Uint8Array,
    options?: any,
  ): Promise<void> {
    const normalized = this._normalizePath(path);
    await super.writeFile(path, content, options);

    const dbPath = this._toDbPath(normalized);
    if (dbPath !== null && dbPath !== "") {
      const finalContent = await this._readPathContent(normalized);
      await runHostStorageOp(() =>
        writeGroupFile(this.db, this.groupId, dbPath, finalContent),
      );
    }
  }

  private _basename(path: string): string {
    const parts = path.split("/").filter(Boolean);

    return parts[parts.length - 1] || "";
  }

  private _isDirectoryStat(stat: any): boolean {
    if (stat && typeof stat.isDirectory === "function") {
      return !!stat.isDirectory();
    }

    return !!stat?.isDirectory;
  }

  private _joinPath(dir: string, name: string): string {
    const normalizedDir = dir.replace(/\/+$/, "");
    if (!normalizedDir) {
      return `/${name}`;
    }

    return `${normalizedDir}/${name}`;
  }

  private _normalizePath(path: string): string {
    const replaced = path.replace(/\\/g, "/");
    const isAbsolute = replaced.startsWith("/");
    const parts = replaced.split("/");
    const stack: string[] = [];

    for (const part of parts) {
      if (!part || part === ".") {
        continue;
      }
      if (part === "..") {
        if (stack.length > 0 && stack[stack.length - 1] !== "..") {
          stack.pop();
        } else if (!isAbsolute) {
          stack.push("..");
        }
      } else {
        stack.push(part);
      }
    }

    return isAbsolute ? `/${stack.join("/")}` : stack.join("/") || ".";
  }

  /**
   * Map from absolute fs path to database path.
   */
  private _toDbPath(path: string): string | null {
    const normalized = this._normalizePath(path);
    const prefix = this._normalizePath(this.workspacePrefix);

    if (normalized.startsWith(prefix + "/")) {
      return normalized.slice(prefix.length + 1);
    } else if (normalized === prefix) {
      return "";
    }

    return null;
  }

  private async _readPathContent(path: string): Promise<Uint8Array | string> {
    try {
      return await super.readFileBuffer(path);
    } catch {
      return await super.readFile(path);
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
  const files: Record<string, () => Promise<Uint8Array | string>> = {};
  const directories = new Set<string>();
  const workspacePrefix = "/home/user";

  async function traverse(dirPath: string): Promise<void> {
    const entries = await listGroupFiles(db, groupId, dirPath);
    for (const entry of entries) {
      if (entry.endsWith("/")) {
        const dirName = entry.slice(0, -1);
        const childPath = dirPath === "." ? dirName : `${dirPath}/${dirName}`;
        directories.add(childPath);
        await traverse(childPath);
      } else {
        const filePath = dirPath === "." ? entry : `${dirPath}/${entry}`;
        const fsPath = `${workspacePrefix}/${filePath}`;
        files[fsPath] = async () => {
          try {
            return await runHostStorageOp(() =>
              readGroupFileBytes(db, groupId, filePath),
            );
          } catch {
            return "";
          }
        };
      }
    }
  }

  await traverse(".");
  const fs = new ShadowClawFileSystem(db, groupId, files, workspacePrefix);

  // Ensure empty directories are visible to shell commands (ls/cd/mv destination checks).
  for (const dirPath of [...directories].sort(
    (a, b) => a.split("/").length - b.split("/").length,
  )) {
    try {
      fs.mkdirSync(`${workspacePrefix}/${dirPath}`, { recursive: true });
    } catch {
      // Ignore directory re-creation races or malformed entries.
    }
  }

  return fs;
}
