import { jest } from "@jest/globals";

jest.unstable_mockModule("./getGroupDir.mjs", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("./parsePath.mjs", () => ({ parsePath: jest.fn() }));

const { writeGroupFile } = await import("./writeGroupFile.mjs");
const { getGroupDir } = await import("./getGroupDir.mjs");
const { parsePath } = await import("./parsePath.mjs");

describe("writeGroupFile", () => {
  it("writes text content to target file", async () => {
    const writable = { write: jest.fn(), close: jest.fn() };
    const fileHandle = {
      createWritable: jest.fn().mockResolvedValue(writable),
    };
    const nested = { getFileHandle: jest.fn().mockResolvedValue(fileHandle) };
    const root = { getDirectoryHandle: jest.fn().mockResolvedValue(nested) };

    getGroupDir.mockResolvedValue(root);
    parsePath.mockReturnValue({ dirs: ["d"], filename: "f.txt" });

    await writeGroupFile({}, "g", "d/f.txt", "hello");

    expect(writable.write).toHaveBeenCalledWith("hello");
    expect(writable.close).toHaveBeenCalled();
  });
});
