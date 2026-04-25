import { jest } from "@jest/globals";

const mockGetGroupDir = jest.fn();

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: mockGetGroupDir,
}));

const { deleteAllGroupFiles } = await import("./deleteAllGroupFiles.js");

describe("deleteAllGroupFiles", () => {
  it("removes each entry recursively", async () => {
    const dir: any = {
      entries: async function* () {
        yield ["a.txt", {}];
        yield ["nested", {}];
      },

      removeEntry: (jest.fn() as any).mockResolvedValue(undefined),
    };

    (mockGetGroupDir as any).mockResolvedValue(dir);

    await deleteAllGroupFiles({} as any, "g1");

    expect(dir.removeEntry).toHaveBeenCalledWith("a.txt", { recursive: true });

    expect(dir.removeEntry).toHaveBeenCalledWith("nested", { recursive: true });
  });
});
