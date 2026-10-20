import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { brotliDecompress, gunzip } from "node:zlib";

import { precompressAssets } from "./precompress-assets.js";

const gunzipAsync = promisify(gunzip);
const brotliDecompressAsync = promisify(brotliDecompress);

describe("precompressAssets", () => {
  let tmpDir: string;

  beforeAll(() => {
    process.env.TEST_PRECOMPRESS = "true";
  });

  afterAll(() => {
    delete process.env.TEST_PRECOMPRESS;
  });

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `precompress-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("generates valid .br and .gz files for compressible assets above min size", async () => {
    const originalText = "Hello world! ".repeat(100); // ~1300 bytes
    const testFile = join(tmpDir, "index.html");
    await writeFile(testFile, originalText, "utf8");

    const result = await precompressAssets(tmpDir);
    expect(result.count).toBe(1);

    // Verify .gz
    const gzContent = await readFile(`${testFile}.gz`);
    const decompressedGz = await gunzipAsync(gzContent);
    expect(decompressedGz.toString("utf8")).toBe(originalText);

    // Verify .br
    const brContent = await readFile(`${testFile}.br`);
    const decompressedBr = await brotliDecompressAsync(brContent);
    expect(decompressedBr.toString("utf8")).toBe(originalText);
  });

  it("skips files smaller than minSizeBytes", async () => {
    const smallText = "tiny";
    const testFile = join(tmpDir, "small.json");
    await writeFile(testFile, smallText, "utf8");

    const result = await precompressAssets(tmpDir);
    expect(result.count).toBe(0);
  });
});
