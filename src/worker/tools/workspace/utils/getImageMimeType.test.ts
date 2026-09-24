import { getImageMimeType, isImagePath } from "../../../../utils/mime.js";

describe("getImageMimeType & isImagePath", () => {
  it("resolves correct MIME types for images", () => {
    expect(getImageMimeType("photo.png")).toBe("image/png");
    expect(getImageMimeType("photo.jpg")).toBe("image/jpeg");
    expect(getImageMimeType("photo.jpeg")).toBe("image/jpeg");
    expect(getImageMimeType("photo.gif")).toBe("image/gif");
    expect(getImageMimeType("photo.webp")).toBe("image/webp");
    expect(getImageMimeType("icon.svg")).toBe("image/svg+xml");
    expect(getImageMimeType("photo.avif")).toBe("image/avif");
    expect(getImageMimeType("photo.bmp")).toBe("image/bmp");
  });

  it("returns null for non-image files or paths without extension", () => {
    expect(getImageMimeType("document.pdf")).toBeNull();
    expect(getImageMimeType("readme.txt")).toBeNull();
    expect(getImageMimeType("file-without-extension")).toBeNull();
    expect(getImageMimeType("")).toBeNull();
  });

  it("identifies image paths correctly via isImagePath", () => {
    expect(isImagePath("dir/photo.PNG")).toBe(true);
    expect(isImagePath("dir/sub/vector.svg")).toBe(true);
    expect(isImagePath("dir/file.txt")).toBe(false);
    expect(isImagePath("dir/code.ts")).toBe(false);
  });
});
