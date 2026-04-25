import { jest } from "@jest/globals";

jest.unstable_mockModule("../config.js", () => ({
  CONFIG_KEYS: { STORAGE_HANDLE: "storage-handle" },
}));

jest.unstable_mockModule("../db/getConfig.js", () => ({
  getConfig: jest.fn(),
}));

const { requestStorageAccess } = await import("./requestStorageAccess.js");
const { getConfig } = await import("../db/getConfig.js");

class MockFileSystemDirectoryHandle {
  async requestPermission() {
    return "granted";
  }
}

(global as any).FileSystemDirectoryHandle = MockFileSystemDirectoryHandle;

describe("requestStorageAccess", () => {
  it("returns true when no local handle is configured", async () => {
    (getConfig as any).mockResolvedValue(null);

    await expect(requestStorageAccess({} as any)).resolves.toBe(true);
  });

  it("returns true when directory handle permission is granted", async () => {
    const handle = new MockFileSystemDirectoryHandle();

    handle.requestPermission = (jest.fn() as any).mockResolvedValue("granted");

    (getConfig as any).mockResolvedValue(handle);

    await expect(requestStorageAccess({} as any)).resolves.toBe(true);

    expect(handle.requestPermission).toHaveBeenCalledWith({
      mode: "readwrite",
    });
  });

  it("returns false when directory handle permission is denied", async () => {
    const handle = new MockFileSystemDirectoryHandle();

    handle.requestPermission = (jest.fn() as any).mockResolvedValue("denied");

    (getConfig as any).mockResolvedValue(handle);

    await expect(requestStorageAccess({} as any)).resolves.toBe(false);
  });

  it("treats non-directory handle config values as OPFS", async () => {
    (getConfig as any).mockResolvedValue({ requestPermission: jest.fn() });

    await expect(requestStorageAccess({} as any)).resolves.toBe(true);
  });
});
