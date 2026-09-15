import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves the absolute path to the root directory of the shadow-claw package.
 * This function works correctly both in local development (src) and when
 * compiled to dist/cli chunks via Rolldown, by walking up the directory tree
 * until it finds the package.json file for shadow-claw.
 */
export function getProjectRoot(metaUrl = import.meta.url): string {
  let current = dirname(fileURLToPath(metaUrl));
  while (true) {
    const pkgPath = join(current, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        if (pkg.name === "shadow-claw") {
          return current;
        }
      } catch (_) {
        // ignore invalid json
      }
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(
        "Could not find shadow-claw project root containing package.json",
      );
    }
    current = parent;
  }
}
