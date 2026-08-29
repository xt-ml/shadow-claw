import { cp, readdir } from "node:fs/promises";
import { join } from "node:path";

export async function copyResourceDirEntries(
  resourceDirs,
  distPublicDir,
  { baseDir = "", readdirImpl = readdir, cpImpl = cp, joinImpl = join } = {},
) {
  for (const resDir of resourceDirs) {
    const resolvedResDir = baseDir ? joinImpl(baseDir, resDir) : resDir;
    try {
      const entries = await readdirImpl(resolvedResDir, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        const srcPath = joinImpl(resolvedResDir, entry.name);
        const destPath = joinImpl(distPublicDir, entry.name);
        if (entry.isDirectory()) {
          await cpImpl(srcPath, destPath, { recursive: true, force: true });
        } else if (entry.isFile()) {
          await cpImpl(srcPath, destPath, { force: true });
        }
      }
    } catch {}
  }
}
