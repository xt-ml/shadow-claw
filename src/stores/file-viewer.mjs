// @ts-ignore
import { Signal } from "signal-polyfill";

import { readGroupFile } from "../storage/readGroupFile.mjs";

import { DEFAULT_GROUP_ID } from "../config.mjs";

/**
 * @typedef {Object} FileInfo
 * @property {string} name
 * @property {string} content
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
      const content = await readGroupFile(db, groupId, path);
      const name = path.split("/").pop() || path;
      this._file.set({ name, content });
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
