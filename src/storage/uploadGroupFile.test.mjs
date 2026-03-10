import { jest } from "@jest/globals";

jest.unstable_mockModule("./getGroupDir.mjs", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("./parsePath.mjs", () => ({ parsePath: jest.fn() }));

const { uploadGroupFile } = await import("./uploadGroupFile.mjs");
const { getGroupDir } = await import("./getGroupDir.mjs");
const { parsePath } = await import("./parsePath.mjs");

describe("uploadGroupFile", () => {
  it("creates nested dirs and writes blob", async () => {
    const writable = { write: jest.fn(), close: jest.fn() };
    const fileHandle = {
      createWritable: jest.fn().mockResolvedValue(writable),
    };
    const nested = { getFileHandle: jest.fn().mockResolvedValue(fileHandle) };
    const root = { getDirectoryHandle: jest.fn().mockResolvedValue(nested) };

    getGroupDir.mockResolvedValue(root);
    parsePath.mockReturnValue({ dirs: ["d"], filename: "f.bin" });

    const blob = new Blob(["hi"]);
    await uploadGroupFile({}, "g", "d/f.bin", blob);

    expect(root.getDirectoryHandle).toHaveBeenCalledWith("d", { create: true });
    expect(writable.write).toHaveBeenCalledWith(blob);
    expect(writable.close).toHaveBeenCalled();
  });
});
