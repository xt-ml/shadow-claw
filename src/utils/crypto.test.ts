import { computeSha256, toArrayBuffer, bufferToHex } from "./crypto.js";

describe("crypto utilities", () => {
  describe("bufferToHex", () => {
    it("converts an ArrayBuffer to lowercase hex string", () => {
      const buffer = new Uint8Array([0, 15, 16, 255]).buffer;
      expect(bufferToHex(buffer)).toBe("000f10ff");
    });
  });

  describe("toArrayBuffer", () => {
    it("converts a string to ArrayBuffer", async () => {
      const buf = await toArrayBuffer("hello");
      expect(buf).toBeInstanceOf(ArrayBuffer);
      expect(new TextDecoder().decode(buf)).toBe("hello");
    });

    it("handles Uint8Array input", async () => {
      const input = new Uint8Array([1, 2, 3]);
      const buf = await toArrayBuffer(input);
      expect(new Uint8Array(buf)).toEqual(new Uint8Array([1, 2, 3]));
    });

    it("handles ArrayBuffer directly", async () => {
      const input = new Uint8Array([4, 5, 6]).buffer;
      const buf = await toArrayBuffer(input);
      expect(new Uint8Array(buf)).toEqual(new Uint8Array([4, 5, 6]));
    });
  });

  describe("computeSha256", () => {
    it("computes SHA-256 hash of a string", async () => {
      // sha256("hello world") = b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
      const hash = await computeSha256("hello world");
      expect(hash).toBe(
        "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
      );
    });

    it("computes SHA-256 hash of Uint8Array bytes", async () => {
      const bytes = new TextEncoder().encode("hello world");
      const hash = await computeSha256(bytes);
      expect(hash).toBe(
        "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
      );
    });
  });
});
