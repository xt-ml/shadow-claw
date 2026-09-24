import { describe, expect, it } from "@jest/globals";
import {
  getMimeType,
  getImageMimeType,
  isImagePath,
  isMimeType,
  guessMimeTypeFromFilename,
  inferAttachmentMimeType,
  mime,
  MIME_TYPES,
  IMAGE_MIME_TYPES,
} from "./mime.js";

describe("src/utils/mime", () => {
  describe("getMimeType", () => {
    it("returns correct MIME type for image extensions", () => {
      expect(getMimeType("photo.png")).toBe("image/png");
      expect(getMimeType("photo.jpg")).toBe("image/jpeg");
      expect(getMimeType("photo.jpeg")).toBe("image/jpeg");
      expect(getMimeType("anim.gif")).toBe("image/gif");
      expect(getMimeType("vector.svg")).toBe("image/svg+xml");
      expect(getMimeType("hero.webp")).toBe("image/webp");
      expect(getMimeType("art.avif")).toBe("image/avif");
      expect(getMimeType("photo.heic")).toBe("image/heic");
      expect(getMimeType("photo.heif")).toBe("image/heif");
      expect(getMimeType("icon.ico")).toBe("image/x-icon");
      expect(getMimeType("photo.tif")).toBe("image/tiff");
      expect(getMimeType("photo.tiff")).toBe("image/tiff");
    });

    it("returns correct MIME type for document, code, and text extensions", () => {
      expect(getMimeType("document.pdf")).toBe("application/pdf");
      expect(getMimeType("notes.txt")).toBe("text/plain");
      expect(getMimeType("README.md")).toBe("text/markdown");
      expect(getMimeType("data.json")).toBe("application/json");
      expect(getMimeType("styles.css")).toBe("text/css");
      expect(getMimeType("index.html")).toBe("text/html");
      expect(getMimeType("script.js")).toBe("text/javascript");
      expect(getMimeType("code.ts")).toBe("text/typescript");
      expect(getMimeType("component.tsx")).toBe("text/typescript");
      expect(getMimeType("config.xml")).toBe("application/xml");
      expect(getMimeType("config.yaml")).toBe("text/yaml");
      expect(getMimeType("config.yml")).toBe("text/yaml");
      expect(getMimeType("data.csv")).toBe("text/csv");
      expect(getMimeType("archive.tar")).toBe("application/x-tar");
      expect(getMimeType("archive.gz")).toBe("application/gzip");
      expect(getMimeType("archive.rar")).toBe("application/vnd.rar");
      expect(getMimeType("module.wasm")).toBe("application/wasm");
      expect(getMimeType("data.bin")).toBe("application/octet-stream");
      expect(getMimeType("database.sqlite")).toBe("application/vnd.sqlite3");
      expect(getMimeType("database.sqlite3")).toBe("application/vnd.sqlite3");
      expect(getMimeType("database.db")).toBe("application/vnd.sqlite3");
      expect(getMimeType("program.exe")).toBe(
        "application/vnd.microsoft.portable-executable",
      );
    });

    it("returns correct MIME type for audio and video extensions", () => {
      expect(getMimeType("audio.mp3")).toBe("audio/mpeg");
      expect(getMimeType("audio.wav")).toBe("audio/wav");
      expect(getMimeType("audio.ogg")).toBe("audio/ogg");
      expect(getMimeType("audio.aac")).toBe("audio/aac");
      expect(getMimeType("audio.flac")).toBe("audio/flac");
      expect(getMimeType("audio.m4a")).toBe("audio/mp4");
      expect(getMimeType("audio.weba")).toBe("audio/webm");
      expect(getMimeType("movie.mp4")).toBe("video/mp4");
      expect(getMimeType("clip.webm")).toBe("video/webm");
      expect(getMimeType("movie.mkv")).toBe("video/x-matroska");
      expect(getMimeType("movie.mov")).toBe("video/mp4");
      expect(getMimeType("movie.avi")).toBe("video/x-msvideo");
      expect(getMimeType("movie.wmv")).toBe("video/x-ms-wmv");
      expect(getMimeType("clip.3gp")).toBe("video/3gpp");
      expect(getMimeType("clip.flv")).toBe("video/x-flv");
    });

    it("returns fallback or undefined for unknown extension", () => {
      expect(getMimeType("unknown.xyz")).toBeUndefined();
      expect(getMimeType("unknown.xyz", "application/octet-stream")).toBe(
        "application/octet-stream",
      );
    });

    it("handles complex paths and case-insensitivity", () => {
      expect(getMimeType("/path/to/my/FILE.PNG")).toBe("image/png");
      expect(getMimeType("C:\\Users\\admin\\DOC.PDF")).toBe("application/pdf");
    });
  });

  describe("getImageMimeType and isImagePath", () => {
    it("returns image MIME type for image extensions", () => {
      expect(getImageMimeType("photo.png")).toBe("image/png");
      expect(getImageMimeType("photo.jpg")).toBe("image/jpeg");
      expect(getImageMimeType("vector.svg")).toBe("image/svg+xml");
      expect(getImageMimeType("photo.heic")).toBe("image/heic");
      expect(getImageMimeType("photo.heif")).toBe("image/heif");
      expect(getImageMimeType("icon.ico")).toBe("image/x-icon");
      expect(getImageMimeType("photo.tiff")).toBe("image/tiff");
      expect(isImagePath("photo.png")).toBe(true);
      expect(isImagePath("photo.jpg")).toBe(true);
      expect(isImagePath("photo.heic")).toBe(true);
      expect(isImagePath("photo.tiff")).toBe(true);
      expect(isImagePath("icon.ico")).toBe(true);
    });

    it("returns null and false for non-image extensions", () => {
      expect(getImageMimeType("document.pdf")).toBeNull();
      expect(getImageMimeType("readme.md")).toBeNull();
      expect(isImagePath("document.pdf")).toBe(false);
      expect(isImagePath("readme.md")).toBe(false);
    });
  });

  describe("isMimeType", () => {
    it("checks specific MIME type or prefix", () => {
      expect(isMimeType("photo.png", "image/png")).toBe(true);
      expect(isMimeType("photo.png", "image/")).toBe(true);
      expect(isMimeType("document.pdf", "image/")).toBe(false);
      expect(isMimeType("document.pdf", "application/pdf")).toBe(true);
      expect(isMimeType("clip.webm", "video/")).toBe(true);
    });
  });

  describe("guessMimeTypeFromFilename (compatibility)", () => {
    it("returns expected types or undefined", () => {
      expect(guessMimeTypeFromFilename("photo.png")).toBe("image/png");
      expect(guessMimeTypeFromFilename("photo.jpg")).toBe("image/jpeg");
      expect(guessMimeTypeFromFilename("notes.txt")).toBe("text/plain");
      expect(guessMimeTypeFromFilename("readme.md")).toBe("text/plain");
      expect(guessMimeTypeFromFilename("readme.markdown")).toBe("text/plain");
      expect(guessMimeTypeFromFilename("archive.zip")).toBeUndefined();
    });
  });

  describe("inferAttachmentMimeType (compatibility)", () => {
    it("prefers explicit MIME type if provided", () => {
      expect(inferAttachmentMimeType("photo.png", "image/custom")).toBe(
        "image/custom",
      );
    });

    it("infers from extension or defaults to application/octet-stream", () => {
      expect(inferAttachmentMimeType("photo.png")).toBe("image/png");
      expect(inferAttachmentMimeType("readme.md")).toBe("text/markdown");
      expect(inferAttachmentMimeType("archive.unknown")).toBe(
        "application/octet-stream",
      );
    });
  });

  describe("mime (unified single function)", () => {
    it("covers both general mime lookup and image-only lookup", () => {
      expect(mime("photo.png")).toBe("image/png");
      expect(mime("doc.pdf")).toBe("application/pdf");
      expect(mime("doc.pdf", { imageOnly: true })).toBeNull();
      expect(mime("unknown.dat", "application/octet-stream")).toBe(
        "application/octet-stream",
      );
    });
  });

  describe("MIME_TYPES and IMAGE_MIME_TYPES maps", () => {
    it("contains standard keys", () => {
      expect(IMAGE_MIME_TYPES.png).toBe("image/png");
      expect(MIME_TYPES.pdf).toBe("application/pdf");
    });
  });
});
