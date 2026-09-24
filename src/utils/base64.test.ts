import { base64, base64ToBytes, bytesToBase64 } from "./base64.js";

describe("base64 utils", () => {
  it("encodes bytes to base64 and decodes back to bytes", async () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const encoded = await bytesToBase64(original);
    expect(encoded).toBe("SGVsbG8=");

    const decoded = await base64ToBytes(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it("handles empty arrays", async () => {
    const empty = new Uint8Array([]);
    const encoded = await bytesToBase64(empty);
    expect(encoded).toBe("");

    const decoded = await base64ToBytes(encoded);
    expect(decoded.length).toBe(0);
  });

  it("supports unified base64 function for both encoding and decoding", () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]);
    const encoded = base64(original);
    expect(encoded).toBe("SGVsbG8=");

    const decoded = base64(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });
});
