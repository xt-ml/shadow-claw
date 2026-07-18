export function isBinaryContent(bytes: Uint8Array): boolean {
  const sampleSize = Math.min(bytes.length, 8192);
  let nonPrintable = 0;

  for (let i = 0; i < sampleSize; i++) {
    const b = bytes[i];
    if (b === 0) {
      return true;
    }

    if (b < 32 && b !== 9 && b !== 10 && b !== 1) {
      nonPrintable++;
    }
  }

  return nonPrintable / sampleSize > 0.1;
}
