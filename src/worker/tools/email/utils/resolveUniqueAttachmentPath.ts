import { ShadowClawDatabase } from "../../../../db/db.js";
import { groupFileExists } from "../../../../storage/groupFileExists.js";
import { ulid } from "../../../../utils/ulid.js";
import { sanitizeFilename } from "./sanitizeFilename.js";

export async function resolveUniqueAttachmentPath(
  db: ShadowClawDatabase,
  groupId: string,
  directory: string,
  rawFilename: string,
): Promise<string> {
  const filename = sanitizeFilename(rawFilename);
  const idx = filename.lastIndexOf(".");
  const stem = idx > 0 ? filename.slice(0, idx) : filename;
  const ext = idx > 0 ? filename.slice(idx) : "";
  const baseDirectory = directory.trim().replace(/^\/+|\/+$/g, "");

  for (let i = 0; i < 1000; i++) {
    const candidateName = i === 0 ? filename : `${stem}-${i + 1}${ext}`;
    const candidatePath = baseDirectory
      ? `${baseDirectory}/${candidateName}`
      : candidateName;
    const exists = await groupFileExists(db, groupId, candidatePath);
    if (!exists) {
      return candidatePath;
    }
  }

  return baseDirectory
    ? `${baseDirectory}/${ulid()}-${filename}`
    : `${ulid()}-${filename}`;
}