import { stat } from "node:fs/promises";

export interface FindFirstExistingPathOptions {
  statImpl?: (path: string) => Promise<any>;
}

export async function findFirstExistingPath(
  candidates: string[],
  { statImpl = stat }: FindFirstExistingPathOptions = {},
): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      await statImpl(candidate);
      return candidate;
    } catch {}
  }
  return null;
}
