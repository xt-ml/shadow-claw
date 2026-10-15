import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let cachedVersion: string | null = null;

export function getPackageVersion(): string {
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    let dir = currentDir;
    while (dir && dir !== path.dirname(dir)) {
      const candidate = path.join(dir, "package.json");
      if (fs.existsSync(candidate)) {
        const pkg = JSON.parse(fs.readFileSync(candidate, "utf8"));
        if (pkg.version) {
          const versionStr = String(pkg.version);
          cachedVersion = versionStr;
          return versionStr;
        }
      }
      dir = path.dirname(dir);
    }
  } catch {}

  const fallback = "1.27.1";
  cachedVersion = fallback;
  return fallback;
}
