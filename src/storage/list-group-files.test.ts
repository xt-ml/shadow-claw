import { jest } from "@jest/globals";

jest.unstable_mockModule("./get-group-dir.js", () => ({
  getGroupDir: jest.fn(),
}));

const { listGroupFiles } = await import("./list-group-files.js");
const { getGroupDir } = await import("./get-group-dir.js");

describe("listGroupFiles", () => {
  it("returns sorted files and directories", async () => {
    const nested: any = {
      entries: async function* () {
        yield ["z.txt", { kind: "file" }];
        yield ["a", { kind: "directory" }];
      },
    };

    const root: any = {
      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(nested),
    };

    (getGroupDir as any).mockResolvedValue(root);

    await expect(listGroupFiles({} as any, "g", "x")).resolves.toEqual([
      "a/",
      "z.txt",
    ]);
  });

  it("throws when isSameEntry detects a stale handle during path navigation", async () => {
    const staleChild: any = {
      name: "sub",

      isSameEntry: (jest.fn() as any).mockResolvedValue(true),
    };
    const root: any = {
      name: "root",

      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(staleChild),

      isSameEntry: (jest.fn() as any).mockResolvedValue(true),
    };

    (getGroupDir as any).mockResolvedValue(root);

    await expect(listGroupFiles({} as any, "g", "sub")).rejects.toThrow(
      /navigation stuck/,
    );
  });
});
