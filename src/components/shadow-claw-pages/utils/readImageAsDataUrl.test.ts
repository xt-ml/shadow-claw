import { describe, it, expect, jest } from "@jest/globals";
import { readImageAsDataUrl } from "./readImageAsDataUrl.js";
import type { ShadowClawDatabase } from "../../../db/types.js";

describe("readImageAsDataUrl", () => {
  it("reads image bytes from database and converts to data URL", async () => {
    const mockDb = {} as any;
    const mockBytes = new Uint8Array([72, 101, 108, 108, 111]);
    const readGroupFileBytesFn = jest
      .fn<
        (
          db: ShadowClawDatabase,
          groupId: string,
          filePath: string,
        ) => Promise<Uint8Array>
      >()
      .mockResolvedValue(mockBytes);

    const result = await readImageAsDataUrl({
      db: mockDb,
      groupId: "main",
      workspacePath: "image.png",
      readGroupFileBytesFn: readGroupFileBytesFn as any,
    });

    expect(readGroupFileBytesFn).toHaveBeenCalledWith(
      mockDb,
      "main",
      "image.png",
    );
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("falls back to fetch candidate URLs when DB fails or missing", async () => {
    const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      blob: async () =>
        new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
    } as any);

    const result = await readImageAsDataUrl({
      db: null,
      groupId: "main",
      workspacePath: "photo.jpg",
      fetchFn: mockFetch as any,
    });

    expect(mockFetch).toHaveBeenCalled();
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("returns null when all fetch candidates fail", async () => {
    const mockFetch = jest
      .fn<typeof fetch>()
      .mockResolvedValue({ ok: false } as any);

    const result = await readImageAsDataUrl({
      db: null,
      groupId: "main",
      workspacePath: "missing.png",
      fetchFn: mockFetch as any,
    });

    expect(result).toBeNull();
  });
});
