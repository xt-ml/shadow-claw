import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { optimizeImgTags } from "./optimize-img-tags.js";

describe("optimizeImgTags", () => {
  let tmpImgPath: string;

  beforeAll(async () => {
    tmpImgPath = join(tmpdir(), `test-img-${Date.now()}.png`);
    // Create a 640x480 PNG header
    const buf = Buffer.alloc(24);
    buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    buf.writeUInt32BE(640, 16);
    buf.writeUInt32BE(480, 20);
    await writeFile(tmpImgPath, buf);
  });

  afterAll(async () => {
    await unlink(tmpImgPath).catch(() => {});
  });

  it("injects width and height from local image file and adds eager/high hints for first image", async () => {
    const html = `<p><img src="${tmpImgPath}" alt="Hero Image"></p>`;
    const optimized = await optimizeImgTags(html);

    expect(optimized).toContain('width="640"');
    expect(optimized).toContain('height="480"');
    expect(optimized).toContain('loading="eager"');
    expect(optimized).toContain('fetchpriority="high"');
    expect(optimized).toContain('decoding="async"');
  });

  it("adds lazy loading for subsequent images", async () => {
    const html = `
      <img src="${tmpImgPath}" alt="First">
      <img src="${tmpImgPath}" alt="Second">
    `;
    const optimized = await optimizeImgTags(html);

    const matches = Array.from(optimized.matchAll(/<img\b([^>]*?)>/g));
    expect(matches).toHaveLength(2);

    expect(matches[0][1]).toContain('loading="eager"');
    expect(matches[0][1]).toContain('fetchpriority="high"');

    expect(matches[1][1]).toContain('loading="lazy"');
    expect(matches[1][1]).not.toContain('fetchpriority="high"');
  });

  it("preserves author-specified width, height, and loading attributes", async () => {
    const html = `<img src="${tmpImgPath}" width="100" height="80" loading="lazy">`;
    const optimized = await optimizeImgTags(html);

    expect(optimized).toContain('width="100"');
    expect(optimized).toContain('height="80"');
    expect(optimized).toContain('loading="lazy"');
    expect(optimized).toContain('decoding="async"');
  });
});
