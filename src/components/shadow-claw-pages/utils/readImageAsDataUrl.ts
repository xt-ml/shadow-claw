import type { ShadowClawDatabase } from "../../../db/types.js";
import { readGroupFileBytes } from "../../../storage/readGroupFileBytes.js";
import { writeGroupFile } from "../../../storage/writeGroupFile.js";
import { mimeTypeForImageExt } from "./mimeTypeForImageExt.js";
import { applyBasePath } from "../../../core/app-routes.js";

export interface ReadImageAsDataUrlOptions {
  db: ShadowClawDatabase | null;
  groupId: string;
  workspacePath: string;
  readGroupFileBytesFn?: typeof readGroupFileBytes;
  writeGroupFileFn?: typeof writeGroupFile;
  fetchFn?: typeof fetch;
}

/**
 * Reads image binary data from database or fetch fallback, returning a base64 Data URL.
 */
export async function readImageAsDataUrl({
  db,
  groupId,
  workspacePath,
  readGroupFileBytesFn = readGroupFileBytes,
  writeGroupFileFn = writeGroupFile,
  fetchFn = typeof fetch !== "undefined" ? fetch : undefined,
}: ReadImageAsDataUrlOptions): Promise<string | null> {
  if (db) {
    try {
      const bytes = await readGroupFileBytesFn(db, groupId, workspacePath);
      const ext = workspacePath.split(".").pop()?.toLowerCase() || "";
      const mimeType = mimeTypeForImageExt(ext);

      const blobBytes = new Uint8Array(bytes.byteLength);
      blobBytes.set(new Uint8Array(bytes));

      const base64 = Buffer.from(blobBytes).toString("base64");
      return `data:${mimeType};base64,${base64}`;
    } catch {
      // Fall through to network fetch fallback
    }
  }

  if (!fetchFn) {
    return null;
  }

  try {
    const cleanPath = workspacePath.replace(/^\/+/, "");
    const candidates = [
      applyBasePath(`/files/main/${cleanPath}`),
      applyBasePath(`/static-main/${cleanPath}`),
      applyBasePath(`/pages/main/${cleanPath}`),
    ];
    for (const url of candidates) {
      try {
        const fullUrl =
          typeof window !== "undefined" && window.location?.origin
            ? new URL(url, window.location.origin).toString()
            : url;
        const res = await fetchFn(fullUrl);
        if (res.ok) {
          const blob = await res.blob();
          if (db) {
            try {
              const buffer = await blob.arrayBuffer();
              await writeGroupFileFn(
                db,
                groupId,
                workspacePath,
                new Uint8Array(buffer),
              );
            } catch {}
          }

          if (typeof FileReader !== "undefined") {
            return await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }

          const arrayBuffer = await blob.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const mimeType =
            blob.type ||
            mimeTypeForImageExt(workspacePath.split(".").pop() || "");
          return `data:${mimeType};base64,${base64}`;
        }
      } catch {}
    }
  } catch {}

  return null;
}
