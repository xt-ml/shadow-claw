import { jest } from "@jest/globals";

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("./parsePath.js", () => ({ parsePath: jest.fn() }));
jest.unstable_mockModule("./storage.js", () => ({
  getStorageStatus: (jest.fn() as any).mockResolvedValue({
    type: "opfs",
    permission: "granted",
    name: "OPFS",
  }),
  invalidateStorageRoot: jest.fn(),
  isStaleHandleError: (jest.fn() as any).mockReturnValue(false),
}));
jest.unstable_mockModule("./writeFileHandle.js", () => ({
  writeFileHandle: (jest.fn() as any).mockResolvedValue(undefined),

  writeOpfsPathViaWorker: (jest.fn() as any).mockResolvedValue(undefined),
}));

const { writeGroupFile } = await import("./writeGroupFile.js");
const { getGroupDir } = await import("./getGroupDir.js");
const { parsePath } = await import("./parsePath.js");
const { getStorageStatus } = await import("./storage.js");
const { writeFileHandle, writeOpfsPathViaWorker } =
  await import("./writeFileHandle.js");

describe("writeGroupFile", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("writes text content to target file", async () => {
    const fileHandle: any = {};

    const nested: any = {
      getFileHandle: (jest.fn() as any).mockResolvedValue(fileHandle),
    };

    const root: any = {
      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(nested),
    };

    (getGroupDir as any).mockResolvedValue(root);

    (parsePath as any).mockReturnValue({ dirs: ["d"], filename: "f.txt" });

    await writeGroupFile({} as any, "g", "d/f.txt", "hello");

    expect(writeFileHandle).toHaveBeenCalledWith(fileHandle, "hello");
  });

  it("falls back to OPFS worker write only when direct handle write is unsupported", async () => {
    const fileHandle: any = {};

    const nested: any = {
      getFileHandle: (jest.fn() as any).mockResolvedValue(fileHandle),
    };

    const root: any = {
      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(nested),
    };

    (getGroupDir as any).mockResolvedValue(root);

    (parsePath as any).mockReturnValue({ dirs: ["d"], filename: "f.txt" });

    (writeFileHandle as any).mockRejectedValueOnce(
      new Error(
        "Writable file streams are not supported by this browser/storage backend.",
      ),
    );

    await writeGroupFile({} as any, "g:01", "d/f.txt", "hello");

    expect(getStorageStatus).toHaveBeenCalledTimes(1);
    expect(writeOpfsPathViaWorker).toHaveBeenCalledWith(
      ["shadowclaw", "groups", "g-01", "d", "f.txt"],
      "hello",
    );
  });

  it("does not fallback to OPFS worker write for local-folder storage", async () => {
    const fileHandle: any = {};

    const nested: any = {
      getFileHandle: (jest.fn() as any).mockResolvedValue(fileHandle),
    };

    const root: any = {
      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(nested),
    };

    (getGroupDir as any).mockResolvedValue(root);

    (parsePath as any).mockReturnValue({ dirs: ["d"], filename: "f.txt" });

    (getStorageStatus as any).mockResolvedValueOnce({
      type: "local",
      permission: "granted",
      name: "My Folder",
    });

    (writeFileHandle as any).mockRejectedValueOnce(
      new Error(
        "Writable file streams are not supported by this browser/storage backend.",
      ),
    );

    await expect(
      writeGroupFile({} as any, "g:01", "d/f.txt", "hello"),
    ).rejects.toThrow("Writable file streams are not supported");

    expect(writeOpfsPathViaWorker).not.toHaveBeenCalled();
  });
});
