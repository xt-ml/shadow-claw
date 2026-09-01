/**
 * ShadowClaw — Client-Side Backup Controller
 *
 * Orchestrates workspace file backups from the browser client's OPFS / local storage
 * to the server via the `/api/backup/*` REST endpoints.
 */

import { ulid } from "../utils/ulid.js";

export interface BackupProgress {
  current: number;
  total: number;
  file: string;
}

export interface BackupControllerOptions {
  clientId: string;
  token?: string;
  serverBaseUrl?: string;
  fileEnumerator?: () => Promise<string[]>;
  fileReader?: (path: string) => Promise<string | Uint8Array | null>;
  onProgress?: (progress: BackupProgress) => void;
}

export interface BackupInitiateResult {
  success: boolean;
  backupId: string;
  fileCount: number;
  totalBytes: number;
}

export class BackupController {
  private _clientId: string;
  private _token?: string;
  private _serverBaseUrl: string;
  private _fileEnumerator: () => Promise<string[]>;
  private _fileReader: (path: string) => Promise<string | Uint8Array | null>;
  private _onProgress?: (progress: BackupProgress) => void;

  constructor(options: BackupControllerOptions) {
    this._clientId = options.clientId;
    this._token = options.token;
    this._serverBaseUrl = options.serverBaseUrl || "";
    this._fileEnumerator = options.fileEnumerator || (async () => []);
    this._fileReader = options.fileReader || (async () => null);
    this._onProgress = options.onProgress;
  }

  public async initiate(): Promise<BackupInitiateResult> {
    const backupId = ulid();
    const files = await this._fileEnumerator();
    let totalBytes = 0;
    let uploadedCount = 0;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this._token) {
      headers["x-control-token"] = this._token;
    }

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      const data = await this._fileReader(filePath);

      if (data === null || data === undefined) {
        continue;
      }

      let contentStr: string;
      let encoding = "utf-8";

      if (typeof data === "string") {
        contentStr = data;
        totalBytes += Buffer.from(data, "utf-8").length;
      } else {
        contentStr = Buffer.from(data).toString("base64");
        encoding = "base64";
        totalBytes += data.byteLength || data.length || 0;
      }

      const uploadUrl = `${this._serverBaseUrl}/api/backup/upload`;
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          clientId: this._clientId,
          backupId,
          path: filePath,
          content: contentStr,
          encoding,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        throw new Error(
          `Upload failed for ${filePath} (${res.status}): ${errorText}`,
        );
      }

      uploadedCount++;
      this._onProgress?.({
        current: uploadedCount,
        total: files.length,
        file: filePath,
      });
    }

    // Finalize backup
    const completeUrl = `${this._serverBaseUrl}/api/backup/complete`;
    const completeRes = await fetch(completeUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        clientId: this._clientId,
        backupId,
        fileCount: uploadedCount,
        totalBytes,
      }),
    });

    if (!completeRes.ok) {
      const errorText = await completeRes
        .text()
        .catch(() => completeRes.statusText);
      throw new Error(`Failed to complete backup: ${errorText}`);
    }

    return {
      success: true,
      backupId,
      fileCount: uploadedCount,
      totalBytes,
    };
  }
}
