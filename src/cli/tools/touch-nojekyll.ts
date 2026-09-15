import { writeFile } from "node:fs/promises";
import path, { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { getProjectRoot } from "../utils/resolve-project-root.js";

export async function touchNoJekyll(
  targetDir?: string,
  { writeFileImpl = writeFile }: { writeFileImpl?: typeof writeFile } = {},
): Promise<void> {
  const dir =
    targetDir || join(getProjectRoot(import.meta.url), "dist", "public");
  await writeFileImpl(join(dir, ".nojekyll"), "", "utf-8");
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  await touchNoJekyll();
}
