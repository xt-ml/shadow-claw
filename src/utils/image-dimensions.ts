export interface ImageDimensions {
  width: number;
  height: number;
  type: "png" | "jpeg" | "gif" | "webp" | "svg";
}

/**
 * Extracts image width and height from raw buffer headers without native dependencies.
 */
export function getImageDimensionsFromBuffer(
  buffer: Buffer,
): ImageDimensions | null {
  if (!buffer || buffer.length < 8) {
    return null;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    if (buffer.length >= 24) {
      return {
        type: "png",
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      };
    }
  }

  // GIF: GIF87a or GIF89a
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    if (buffer.length >= 10) {
      return {
        type: "gif",
        width: buffer.readUInt16LE(6),
        height: buffer.readUInt16LE(8),
      };
    }
  }

  // WebP: RIFF ... WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.length >= 30 &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    const chunkType = buffer.subarray(12, 16).toString("ascii");
    if (chunkType === "VP8 ") {
      // VP8 lossy
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return { type: "webp", width, height };
    }
    if (chunkType === "VP8L" && buffer.length >= 25) {
      // VP8L lossless
      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { type: "webp", width, height };
    }
    if (chunkType === "VP8X") {
      // VP8X extended
      const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
      const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
      return { type: "webp", width, height };
    }
  }

  // JPEG: starts with FF D8
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 1) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      // Baseline and Progressive SOF markers: SOF0 to SOF3, SOF5 to SOF7, SOF9 to SOF11, SOF13 to SOF15
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        if (offset + 9 <= buffer.length) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { type: "jpeg", width, height };
        }
      }
      if (marker === 0xd9 || marker === 0xda) {
        // EOI (End of Image) or SOS (Start of Scan)
        break;
      }
      if (offset + 3 < buffer.length) {
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      } else {
        break;
      }
    }
  }

  // SVG: <?xml or <svg
  const headStr = buffer.subarray(0, 1024).toString("utf8");
  if (/<svg\b[^>]*>/iu.test(headStr)) {
    const widthMatch = headStr.match(/\bwidth=["']?(\d+(?:\.\d+)?)/iu);
    const heightMatch = headStr.match(/\bheight=["']?(\d+(?:\.\d+)?)/iu);
    if (widthMatch && heightMatch) {
      return {
        type: "svg",
        width: Math.round(parseFloat(widthMatch[1])),
        height: Math.round(parseFloat(heightMatch[1])),
      };
    }
    const viewBoxMatch = headStr.match(
      /\bviewBox=["']?\s*[\d.-]+\s+[\d.-]+\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/iu,
    );
    if (viewBoxMatch) {
      return {
        type: "svg",
        width: Math.round(parseFloat(viewBoxMatch[1])),
        height: Math.round(parseFloat(viewBoxMatch[2])),
      };
    }
  }

  return null;
}

/**
 * Asynchronously reads the image file header and returns its dimensions.
 * Uses process.getBuiltinModule in Node environments to avoid static bundler
 * import resolution errors in browser client builds.
 */
export async function getImageFileDimensions(
  filePath: string,
): Promise<ImageDimensions | null> {
  try {
    let readFileFn: ((path: string) => Promise<Buffer>) | null = null;
    let resolveFn: ((path: string) => string) | null = null;

    if (
      typeof process !== "undefined" &&
      typeof (process as any).getBuiltinModule === "function"
    ) {
      const fsMod = (process as any).getBuiltinModule("node:fs/promises");
      const pathMod = (process as any).getBuiltinModule("node:path");
      readFileFn = fsMod?.readFile;
      resolveFn = pathMod?.resolve;
    }

    if (!readFileFn) {
      return null;
    }

    const resolvedPath = resolveFn ? resolveFn(filePath) : filePath;
    const fileBuffer = await readFileFn(resolvedPath);
    return getImageDimensionsFromBuffer(fileBuffer);
  } catch {
    return null;
  }
}
