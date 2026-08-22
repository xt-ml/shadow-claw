import { stat } from "node:fs/promises";

export async function findFirstExistingPath(
  candidates,
  { statImpl = stat } = {},
) {
  for (const candidate of candidates) {
    try {
      await statImpl(candidate);
      return candidate;
    } catch {}
  }
  return null;
}
