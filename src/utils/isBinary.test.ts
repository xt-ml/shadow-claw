import { describe, expect, it } from "@jest/globals";
import { isBinary, isBinaryContent, isBinaryContentType } from "./isBinary.js";

describe("src/utils/isBinary", () => {
  describe("isBinary with Uint8Array (bytes)", () => {
    it("returns false for printable UTF-8 text", () => {
      const text = new TextEncoder().encode(
        "Hello, World! This is plain text.\nLine 2.\tTabbed.\r\n",
      );
      expect(isBinary(text)).toBe(false);
    });

    it("returns true if null byte (0) is present", () => {
      const bytes = new Uint8Array([72, 101, 108, 0, 111]); // "Hel\0o"
      expect(isBinary(bytes)).toBe(true);
    });

    it("returns true for high ratio of non-printable bytes", () => {
      const binaryData = new Uint8Array([
        1, 2, 3, 4, 5, 6, 7, 8, 14, 15, 65, 66,
      ]);
      expect(isBinary(binaryData)).toBe(true);
    });

    it("handles empty byte arrays gracefully", () => {
      expect(isBinary(new Uint8Array([]))).toBe(false);
    });
  });

  describe("isBinary with string (MIME type or file path)", () => {
    it("returns true for binary MIME types", () => {
      expect(isBinary("image/png")).toBe(true);
      expect(isBinary("video/mp4")).toBe(true);
      expect(isBinary("audio/mpeg")).toBe(true);
      expect(isBinary("application/pdf")).toBe(true);
      expect(isBinary("application/octet-stream")).toBe(true);
      expect(isBinary("application/zip")).toBe(true);
      expect(isBinary("application/gzip")).toBe(true);
      expect(isBinary("application/x-tar")).toBe(true);
      expect(isBinary("application/vnd.rar")).toBe(true);
      expect(isBinary("application/wasm")).toBe(true);
      expect(isBinary("application/vnd.sqlite3")).toBe(true);
      expect(isBinary("application/vnd.microsoft.portable-executable")).toBe(
        true,
      );
    });

    it("returns false for text MIME types", () => {
      expect(isBinary("text/plain")).toBe(false);
      expect(isBinary("text/html")).toBe(false);
      expect(isBinary("text/markdown")).toBe(false);
      expect(isBinary("application/json")).toBe(false);
      expect(isBinary("text/javascript")).toBe(false);
      expect(isBinary("application/xml")).toBe(false);
      expect(isBinary("text/yaml")).toBe(false);
    });

    it("returns true for binary file extensions/paths", () => {
      expect(isBinary("photo.png")).toBe(true);
      expect(isBinary("/docs/document.pdf")).toBe(true);
      expect(isBinary("archive.zip")).toBe(true);
      expect(isBinary("archive.tar")).toBe(true);
      expect(isBinary("archive.rar")).toBe(true);
      expect(isBinary("module.wasm")).toBe(true);
      expect(isBinary("database.sqlite3")).toBe(true);
      expect(isBinary("program.exe")).toBe(true);
    });

    it("returns false for text file extensions/paths", () => {
      expect(isBinary("readme.md")).toBe(false);
      expect(isBinary("notes.txt")).toBe(false);
      expect(isBinary("app.ts")).toBe(false);
      expect(isBinary("data.csv")).toBe(false);
      expect(isBinary("config.yaml")).toBe(false);
    });
  });

  describe("compatibility aliases", () => {
    it("isBinaryContent works with Uint8Array", () => {
      const text = new TextEncoder().encode("Simple text");
      expect(isBinaryContent(text)).toBe(false);
      const bin = new Uint8Array([0, 1, 2]);
      expect(isBinaryContent(bin)).toBe(true);
    });

    it("isBinaryContentType works with content-type string", () => {
      expect(isBinaryContentType("image/jpeg")).toBe(true);
      expect(isBinaryContentType("text/plain")).toBe(false);
    });
  });
});
