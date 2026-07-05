import { Signal } from "signal-polyfill";

import { readGroupFile } from "../storage/readGroupFile.js";
import { readGroupFileBytes } from "../storage/readGroupFileBytes.js";
import { getGroupFile } from "../storage/getGroupFile.js";
import { DEFAULT_GROUP_ID } from "../config/config.js";
import type { ShadowClawDatabase } from "../db/types.js";

export interface FileInfo {
  name: string;
  path?: string;
  content: string;
  kind: "text" | "pdf" | "binary";
  binaryContent: Uint8Array | null;
  nativeFile?: File | null;
  mimeType: string;
}

export interface FileViewerState {
  file: FileInfo | null;
  openFile: (
    db: ShadowClawDatabase,
    path: string,
    groupId?: string,
  ) => Promise<void>;
  closeFile: () => void;
}

export class FileViewerStore {
  private _file: Signal.State<FileInfo | null>;

  constructor() {
    this._file = new Signal.State(null);
  }

  get file(): FileInfo | null {
    return this._file.get();
  }

  /**
   * Open a file
   */
  async openFile(
    db: ShadowClawDatabase,
    path: string,
    groupId: string = DEFAULT_GROUP_ID,
  ): Promise<void> {
    try {
      const name = path.split("/").pop() || path;
      const isPdf = /\.pdf$/i.test(name);
      const binaryMimeType = this.getPreviewBinaryMimeType(name);

      if (isPdf) {
        const binaryContent = await readGroupFileBytes(db, groupId, path);

        this._file.set({
          name,
          path,
          content: "",
          kind: "pdf",
          binaryContent,
          mimeType: "application/pdf",
        });

        return;
      }

      if (binaryMimeType) {
        const nativeFile = await getGroupFile(db, groupId, path);

        this._file.set({
          name,
          path,
          content: "",
          kind: "binary",
          binaryContent: null,
          nativeFile,
          mimeType: binaryMimeType,
        });

        return;
      }

      const content = await readGroupFile(db, groupId, path);
      this._file.set({
        name,
        path,
        content,
        kind: "text",
        binaryContent: null,
        mimeType: "text/plain",
      });
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
   */
  getFile(): FileInfo | null {
    return this.file;
  }

  /**
   * Get preview binary MIME type
   */
  getPreviewBinaryMimeType(fileName: string): string {
    const extension = fileName.toLowerCase().split(".").pop() || "";

    const mimeTypes: Record<string, string> = {
      "3gp": "video/3gpp",
      "7z": "application/x-7z-compressed",
      aac: "audio/aac",
      apng: "image/apng",
      avi: "video/x-msvideo",
      avif: "image/avif",
      bin: "application/octet-stream",
      bmp: "image/bmp",
      db: "application/vnd.sqlite3",
      dll: "application/octet-stream",
      dmg: "application/octet-stream",
      dylib: "application/octet-stream",
      exe: "application/vnd.microsoft.portable-executable",
      flac: "audio/flac",
      flv: "video/x-flv",
      gif: "image/gif",
      gz: "application/gzip",
      heic: "image/heic",
      heif: "image/heif",
      ico: "image/x-icon",
      iso: "application/octet-stream",
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      m4a: "audio/mp4",
      m4v: "video/mp4",
      mkv: "video/x-matroska",
      mov: "video/mp4",
      mp3: "audio/mpeg",
      mp4: "video/mp4",
      oga: "audio/ogg",
      ogg: "audio/ogg",
      ogv: "video/ogg",
      png: "image/png",
      rar: "application/vnd.rar",
      so: "application/octet-stream",
      sqlite: "application/vnd.sqlite3",
      sqlite3: "application/vnd.sqlite3",
      tar: "application/x-tar",
      tif: "image/tiff",
      tiff: "image/tiff",
      ts: "video/mp2t",
      wasm: "application/wasm",
      wav: "audio/wav",
      weba: "audio/webm",
      webm: "video/webm",
      webp: "image/webp",
      wmv: "video/x-ms-wmv",
      zip: "application/zip",
    };

    return mimeTypes[extension] || "";
  }
}

export const fileViewerStore = new FileViewerStore();
