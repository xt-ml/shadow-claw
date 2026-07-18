import { IMAGE_MIME_TYPES } from "../types";

export function getImageMimeType(path: string): string | null {
  const ext = path.toLowerCase().split(".").pop() || "";

  return IMAGE_MIME_TYPES[ext] || null;
}
