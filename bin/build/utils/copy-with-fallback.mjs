import { cp, stat } from "node:fs/promises";

export async function copyWithFallback(
  sources,
  dest,
  opts = {},
  { statImpl = stat, cpImpl = cp } = {},
) {
  const candidates = Array.isArray(sources) ? sources : [sources];
  for (const candidate of candidates) {
    try {
      await statImpl(candidate);
      await cpImpl(candidate, dest, opts);
      return true;
    } catch {}
  }
  return false;
}
