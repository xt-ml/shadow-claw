/**
 * Cryptographic hashing and buffer conversion utilities.
 *
 * @module crypto
 */

export type HashInput = string | File | Blob | ArrayBuffer | ArrayBufferView;

/**
 * Convert various input types to an ArrayBuffer for hashing.
 */
export async function toArrayBuffer(input: HashInput): Promise<ArrayBuffer> {
  if (typeof input === "string") {
    return new TextEncoder().encode(input).buffer as ArrayBuffer;
  }

  if (typeof Blob !== "undefined" && input instanceof Blob) {
    return input.arrayBuffer();
  }

  if (input instanceof ArrayBuffer) {
    return input.slice(0);
  }

  if (ArrayBuffer.isView(input)) {
    const { buffer, byteOffset, byteLength } = input;
    return buffer.slice(byteOffset, byteOffset + byteLength) as ArrayBuffer;
  }

  return new ArrayBuffer(0);
}

/**
 * Convert an ArrayBuffer to a hex string.
 */
export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute the SHA-256 hash and return it as a hex string.
 */
export async function computeSha256(input: HashInput): Promise<string> {
  const data = await toArrayBuffer(input);
  const subtle =
    globalThis.crypto?.subtle ??
    (globalThis as any).window?.crypto?.subtle ??
    (typeof process !== "undefined"
      ? (await import("node:crypto")).webcrypto?.subtle
      : undefined);

  if (!subtle) {
    throw new Error("crypto.subtle is not available in current environment");
  }

  const hashBuffer = await subtle.digest("SHA-256", data);

  return bufferToHex(hashBuffer);
}
