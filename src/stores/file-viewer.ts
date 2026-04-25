// @ts-ignore
import { Signal } from "signal-polyfill";

import { readGroupFile } from "../storage/readGroupFile.js";
import { readGroupFileBytes } from "../storage/readGroupFileBytes.js";
import { DEFAULT_GROUP_ID } from "../config.js";
import type { ShadowClawDatabase } from "../types.js";

export interface FileInfo {
  name: string;
  path?: string;
  content: string;
  kind: "text" | "pdf" | "binary";
  binaryContent: Uint8Array | null;
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
        const binaryContent = await readGroupFileBytes(db, groupId, path);

        this._file.set({
          name,
          path,
          content: "",
          kind: "binary",
          binaryContent,
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
      apng: "image/apng",
      avif: "image/avif",
      bmp: "image/bmp",
      gif: "image/gif",
      ico: "image/x-icon",
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      m4a: "audio/mp4",
      mp3: "audio/mpeg",
      mp4: "video/mp4",
      oga: "audio/ogg",
      ogg: "audio/ogg",
      ogv: "video/ogg",
      png: "image/png",
      wav: "audio/wav",
      webm: "video/webm",
      webp: "image/webp",
    };

    return mimeTypes[extension] || "";
  }
}

export const fileViewerStore = new FileViewerStore();
