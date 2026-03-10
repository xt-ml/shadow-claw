import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/setConfig.mjs", () => ({
  setConfig: jest.fn().mockResolvedValue(undefined),
}));

const { selectStorageDirectory } = await import("./selectStorageDirectory.mjs");
const { setConfig } = await import("../db/setConfig.mjs");

describe("selectStorageDirectory", () => {
  it("stores selected directory handle", async () => {
    const handle = { name: "dir" };
    window.showDirectoryPicker = jest.fn().mockResolvedValue(handle);

    await expect(selectStorageDirectory({})).resolves.toBe(true);
    expect(setConfig).toHaveBeenCalled();
  });

  it("returns false when user aborts picker", async () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    window.showDirectoryPicker = jest.fn().mockRejectedValue(err);

    await expect(selectStorageDirectory({})).resolves.toBe(false);
  });
});
