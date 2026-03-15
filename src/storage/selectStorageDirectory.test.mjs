import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/setConfig.mjs", () => ({
  setConfig: jest.fn().mockResolvedValue(undefined),
}));

const { selectStorageDirectory } = await import("./selectStorageDirectory.mjs");
const { setConfig } = await import("../db/setConfig.mjs");

describe("selectStorageDirectory", () => {
  it("stores selected directory handle", async () => {
    const handle = { name: "dir" };
    globalThis.showDirectoryPicker = jest.fn().mockResolvedValue(handle);

    await expect(selectStorageDirectory({})).resolves.toBe(true);

    expect(setConfig).toHaveBeenCalled();
  });

  it("returns false when user aborts picker", async () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    globalThis.showDirectoryPicker = jest.fn().mockRejectedValue(err);

    await expect(selectStorageDirectory({})).resolves.toBe(false);
  });

  it("throws when directory picker feature is unavailable", async () => {
    const previousPicker = globalThis.showDirectoryPicker;

    try {
      // @ts-ignore
      delete globalThis.showDirectoryPicker;
      await expect(selectStorageDirectory({})).rejects.toThrow(
        "Local folder picker is unavailable in this browser/context.",
      );
    } finally {
      globalThis.showDirectoryPicker = previousPicker;
    }
  });
});
