export async function bytesToBase64(bytes: Uint8Array): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.readAsDataURL(new Blob([bytes as any]));
  });
}

export async function base64ToBytes(base64: string): Promise<Uint8Array> {
  const res = await fetch(`data:application/octet-stream;base64,${base64}`);
  const buf = await res.arrayBuffer();

  return new Uint8Array(buf);
}
