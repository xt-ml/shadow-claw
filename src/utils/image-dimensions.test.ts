import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  getImageDimensionsFromBuffer,
  getImageFileDimensions,
} from "./image-dimensions.js";

describe("image-dimensions", () => {
  it("extracts PNG dimensions from header buffer", () => {
    // 8-byte signature + 4-byte chunk len + 4-byte 'IHDR' + 4-byte width (800) + 4-byte height (600)
    const buf = Buffer.alloc(24);
    buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    buf.writeUInt32BE(800, 16);
    buf.writeUInt32BE(600, 20);

    const dims = getImageDimensionsFromBuffer(buf);
    expect(dims).toEqual({ type: "png", width: 800, height: 600 });
  });

  it("extracts GIF dimensions from header buffer", () => {
    // 'GIF89a' + 2-byte width (320) + 2-byte height (240)
    const buf = Buffer.alloc(10);
    buf.write("GIF89a", 0, "ascii");
    buf.writeUInt16LE(320, 6);
    buf.writeUInt16LE(240, 8);

    const dims = getImageDimensionsFromBuffer(buf);
    expect(dims).toEqual({ type: "gif", width: 320, height: 240 });
  });

  it("extracts WebP VP8 lossy dimensions from header buffer", () => {
    // RIFF....WEBPVP8 ...
    const buf = Buffer.alloc(30);
    buf.write("RIFF", 0, "ascii");
    buf.write("WEBP", 8, "ascii");
    buf.write("VP8 ", 12, "ascii");
    // At byte 26: width (1280), at byte 28: height (720)
    buf.writeUInt16LE(1280, 26);
    buf.writeUInt16LE(720, 28);

    const dims = getImageDimensionsFromBuffer(buf);
    expect(dims).toEqual({ type: "webp", width: 1280, height: 720 });
  });

  it("extracts JPEG SOF0 dimensions", () => {
    // FF D8 (SOI) + FF C0 (SOF0) + length (2 bytes) + precision (1) + height (480) + width (640)
    const buf = Buffer.from([
      0xff,
      0xd8,
      0xff,
      0xc0,
      0x00,
      0x11, // length 17
      0x08, // precision 8
      0x01,
      0xe0, // height 480
      0x02,
      0x80, // width 640
      0x03,
      0x01,
      0x11,
      0x00,
      0x02,
      0x11,
      0x01,
      0x03,
      0x11,
      0x01,
      0xff,
      0xd9, // EOI
    ]);

    const dims = getImageDimensionsFromBuffer(buf);
    expect(dims).toEqual({ type: "jpeg", width: 640, height: 480 });
  });

  it("extracts image dimensions from file on disk", async () => {
    const testFile = join(tmpdir(), `test-img-${Date.now()}.png`);
    const buf = Buffer.alloc(24);
    buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    buf.writeUInt32BE(1024, 16);
    buf.writeUInt32BE(768, 20);

    await writeFile(testFile, buf);
    try {
      const dims = await getImageFileDimensions(testFile);
      expect(dims).toEqual({ type: "png", width: 1024, height: 768 });
    } finally {
      await unlink(testFile).catch(() => {});
    }
  });

  it("returns null for non-image or corrupted buffers", () => {
    expect(getImageDimensionsFromBuffer(Buffer.from("Hello world"))).toBeNull();
    expect(getImageDimensionsFromBuffer(Buffer.alloc(4))).toBeNull();
  });
});
