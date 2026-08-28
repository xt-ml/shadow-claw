import { mimeTypeForImageExt } from "./mimeTypeForImageExt.js";

describe("mimeTypeForImageExt", () => {
  it("returns correct MIME types for known image extensions", () => {
    expect(mimeTypeForImageExt("apng")).toBe("image/apng");
    expect(mimeTypeForImageExt("avif")).toBe("image/avif");
    expect(mimeTypeForImageExt("gif")).toBe("image/gif");
    expect(mimeTypeForImageExt("jpg")).toBe("image/jpeg");
    expect(mimeTypeForImageExt("jpeg")).toBe("image/jpeg");
    expect(mimeTypeForImageExt("png")).toBe("image/png");
    expect(mimeTypeForImageExt("svg")).toBe("image/svg+xml");
    expect(mimeTypeForImageExt("webp")).toBe("image/webp");
  });

  it("defaults to image/jpeg for unknown or empty extensions", () => {
    expect(mimeTypeForImageExt("bmp")).toBe("image/jpeg");
    expect(mimeTypeForImageExt("unknown")).toBe("image/jpeg");
    expect(mimeTypeForImageExt("")).toBe("image/jpeg");
  });
});
