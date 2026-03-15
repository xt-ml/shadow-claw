import { jest } from "@jest/globals";

jest.unstable_mockModule("../config.mjs", () => ({
  CONFIG_KEYS: { STORAGE_HANDLE: "storage-handle" },
}));

jest.unstable_mockModule("../db/getConfig.mjs", () => ({
  getConfig: jest.fn(),
}));

const { requestStorageAccess } = await import("./requestStorageAccess.mjs");
const { getConfig } = await import("../db/getConfig.mjs");

class MockFileSystemDirectoryHandle {
  async requestPermission() {
    return "granted";
  }
}

global.FileSystemDirectoryHandle = MockFileSystemDirectoryHandle;

describe("requestStorageAccess", () => {
  it("returns true when no local handle is configured", async () => {
    getConfig.mockResolvedValue(null);

    await expect(requestStorageAccess({})).resolves.toBe(true);
  });

  it("returns true when directory handle permission is granted", async () => {
    const handle = new MockFileSystemDirectoryHandle();
    handle.requestPermission = jest.fn().mockResolvedValue("granted");
    getConfig.mockResolvedValue(handle);

    await expect(requestStorageAccess({})).resolves.toBe(true);

    expect(handle.requestPermission).toHaveBeenCalledWith({
      mode: "readwrite",
    });
  });

  it("returns false when directory handle permission is denied", async () => {
    const handle = new MockFileSystemDirectoryHandle();
    handle.requestPermission = jest.fn().mockResolvedValue("denied");
    getConfig.mockResolvedValue(handle);

    await expect(requestStorageAccess({})).resolves.toBe(false);
  });

  it("treats non-directory handle config values as OPFS", async () => {
    getConfig.mockResolvedValue({ requestPermission: jest.fn() });

    await expect(requestStorageAccess({})).resolves.toBe(true);
  });
});
