export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function base64ToBytes(base64Str: string): Uint8Array {
  const binary = atob(base64Str);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }

  return out;
}

export function base64(data: Uint8Array): string;
export function base64(data: string): Uint8Array;
export function base64(data: Uint8Array | string): string | Uint8Array {
  if (typeof data === "string") {
    return base64ToBytes(data);
  }

  return bytesToBase64(data);
}
