import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/setConfig.js", () => ({
  setConfig: (jest.fn() as any).mockResolvedValue(undefined),
}));

jest.unstable_mockModule("./ensureMainGroupMemory.js", () => ({
  ensureMainGroupMemory: (jest.fn() as any).mockResolvedValue(true),
}));

jest.unstable_mockModule("./ensureMainGroupIndex.js", () => ({
  ensureMainGroupIndex: (jest.fn() as any).mockResolvedValue(true),
}));

const { selectStorageDirectory } = await import("./selectStorageDirectory.js");
const { setConfig } = await import("../db/setConfig.js");
const { ensureMainGroupMemory } = await import("./ensureMainGroupMemory.js");
const { ensureMainGroupIndex } = await import("./ensureMainGroupIndex.js");

describe("selectStorageDirectory", () => {
  it("stores selected directory handle", async () => {
    const handle: any = { name: "dir" };

    (globalThis as any).showDirectoryPicker = (
      jest.fn() as any
    ).mockResolvedValue(handle);

    await expect(selectStorageDirectory({} as any)).resolves.toBe(true);

    expect(setConfig).toHaveBeenCalled();
    expect(ensureMainGroupMemory).toHaveBeenCalledWith({} as any);
    expect(ensureMainGroupIndex).toHaveBeenCalledWith({} as any);
  });

  it("returns false when user aborts picker", async () => {
    const err = new Error("aborted");
    err.name = "AbortError";

    (globalThis as any).showDirectoryPicker = (
      jest.fn() as any
    ).mockRejectedValue(err);

    await expect(selectStorageDirectory({} as any)).resolves.toBe(false);
  });

  it("throws when directory picker feature is unavailable", async () => {
    const previousPicker = (globalThis as any).showDirectoryPicker;

    try {
      delete (globalThis as any).showDirectoryPicker;

      await expect(selectStorageDirectory({} as any)).rejects.toThrow(
        "Local folder picker is unavailable in this browser/context.",
      );
    } finally {
      (globalThis as any).showDirectoryPicker = previousPicker;
    }
  });
});
