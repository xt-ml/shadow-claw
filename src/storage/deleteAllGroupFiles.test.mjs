import { jest } from "@jest/globals";

const mockGetGroupDir = jest.fn();

jest.unstable_mockModule("./getGroupDir.mjs", () => ({
  getGroupDir: mockGetGroupDir,
}));

const { deleteAllGroupFiles } = await import("./deleteAllGroupFiles.mjs");

describe("deleteAllGroupFiles", () => {
  it("removes each entry recursively", async () => {
    const dir = {
      entries: async function* () {
        yield ["a.txt", {}];
        yield ["nested", {}];
      },
      removeEntry: jest.fn().mockResolvedValue(undefined),
    };
    mockGetGroupDir.mockResolvedValue(dir);

    await deleteAllGroupFiles({}, "g1");

    expect(dir.removeEntry).toHaveBeenCalledWith("a.txt", { recursive: true });
    expect(dir.removeEntry).toHaveBeenCalledWith("nested", { recursive: true });
  });
});
