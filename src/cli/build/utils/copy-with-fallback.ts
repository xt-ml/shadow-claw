import { cp, stat } from "node:fs/promises";

export interface CopyWithFallbackOptions {
  statImpl?: (path: string) => Promise<any>;
  cpImpl?: (src: string, dest: string, opts?: any) => Promise<any>;
}

export async function copyWithFallback(
  sources: string | string[],
  dest: string,
  opts: any = {},
  { statImpl = stat, cpImpl = cp }: CopyWithFallbackOptions = {},
): Promise<boolean> {
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
