// @ts-ignore
import { Signal } from "signal-polyfill";

import { readGroupFile } from "../storage/readGroupFile.mjs";
import { readGroupFileBytes } from "../storage/readGroupFileBytes.mjs";

import { DEFAULT_GROUP_ID } from "../config.mjs";

/**
 * @typedef {Object} FileInfo
 * @property {string} name
 * @property {string} content
 * @property {"text"|"pdf"} kind
 * @property {Uint8Array|null} binaryContent
 */

/**
 * @typedef {Object} FileViewerState
 * @property {FileInfo|null} file
 * @property {(path: string, groupId?: string) => Promise<void>} openFile
 * @property {() => void} closeFile
 */

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

export class FileViewerStore {
  constructor() {
    /** @type {Signal.State<FileInfo|null>} */
    this._file = new Signal.State(null);
  }

  get file() {
    return this._file.get();
  }

  /**
   * Open a file
   *
   * @param {ShadowClawDatabase} db
   * @param {string} path
   * @param {string} [groupId=DEFAULT_GROUP_ID]
   *
   * @returns {Promise<void>}
   */
  async openFile(db, path, groupId = DEFAULT_GROUP_ID) {
    try {
      const name = path.split("/").pop() || path;
      const isPdf = /\.pdf$/i.test(name);

      if (isPdf) {
        const binaryContent = await readGroupFileBytes(db, groupId, path);

        this._file.set({ name, content: "", kind: "pdf", binaryContent });
        return;
      }

      const content = await readGroupFile(db, groupId, path);
      this._file.set({ name, content, kind: "text", binaryContent: null });
    } catch (err) {
      console.error("Failed to open file:", path, err);
      throw err;
    }
  }

  /**
   * Close the current file
   */
  closeFile() {
    this._file.set(null);
  }

  /**
   * Get current file
   * @returns {Object|null}
   */
  getFile() {
    return this.file;
  }
}

export const fileViewerStore = new FileViewerStore();
