import { jest } from "@jest/globals";

jest.unstable_mockModule("./getGroupDir.mjs", () => ({
  getGroupDir: jest.fn(),
}));

const { listGroupFiles } = await import("./listGroupFiles.mjs");
const { getGroupDir } = await import("./getGroupDir.mjs");

describe("listGroupFiles", () => {
  it("returns sorted files and directories", async () => {
    const nested = {
      entries: async function* () {
        yield ["z.txt", { kind: "file" }];
        yield ["a", { kind: "directory" }];
      },
    };
    const root = { getDirectoryHandle: jest.fn().mockResolvedValue(nested) };
    getGroupDir.mockResolvedValue(root);

    await expect(listGroupFiles({}, "g", "x")).resolves.toEqual([
      "a/",
      "z.txt",
    ]);
  });
});
