import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import { constants, brotliCompress, gzip } from "node:zlib";

const brotliCompressAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

const COMPRESSIBLE_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".xhtml",
  ".js",
  ".mjs",
  ".cjs",
  ".css",
  ".json",
  ".svg",
  ".xml",
  ".txt",
]);

const MIN_SIZE_BYTES = 512;

export interface PrecompressOptions {
  extensions?: Set<string>;
  minSizeBytes?: number;
  silent?: boolean;
}

async function collectFiles(
  dir: string,
  fileList: string[] = [],
): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await collectFiles(fullPath, fileList);
      } else if (entry.isFile()) {
        fileList.push(fullPath);
      }
    }
  } catch {
    // Ignore non-readable directories
  }
  return fileList;
}

/**
 * Pre-compresses static assets in targetDir into sibling .br and .gz files.
 */
export async function precompressAssets(
  targetDir: string,
  options: PrecompressOptions = {},
): Promise<{ count: number; totalSavedBytes: number }> {
  const exts = options.extensions || COMPRESSIBLE_EXTENSIONS;
  const minSize = options.minSizeBytes ?? MIN_SIZE_BYTES;

  if (process.env.NODE_ENV === "test" && !process.env.TEST_PRECOMPRESS) {
    return { count: 0, totalSavedBytes: 0 };
  }

  const files = await collectFiles(targetDir);
  let count = 0;
  let totalSavedBytes = 0;

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (ext === ".br" || ext === ".gz" || !exts.has(ext)) {
      continue;
    }

    try {
      const fileStat = await stat(file);
      if (fileStat.size < minSize) {
        continue;
      }

      const content = await readFile(file);

      // Generate Gzip (.gz)
      const gzBuf = await gzipAsync(content, {
        level: 6,
      });
      await writeFile(`${file}.gz`, gzBuf);

      // Generate Brotli (.br)
      const brBuf = await brotliCompressAsync(content, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 5,
        },
      });
      await writeFile(`${file}.br`, brBuf);

      count++;
      totalSavedBytes += fileStat.size - Math.min(gzBuf.length, brBuf.length);
    } catch (err) {
      if (!options.silent) {
        console.warn(`Failed to pre-compress ${file}:`, err);
      }
    }
  }

  return { count, totalSavedBytes };
}
