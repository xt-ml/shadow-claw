import { jest } from "@jest/globals";

jest.unstable_mockModule("./getGroupDir.mjs", () => ({
  getGroupDir: jest.fn(),
}));

const { getWorkspaceDir } = await import("./getWorkspaceDir.mjs");
const { getGroupDir } = await import("./getGroupDir.mjs");

describe("getWorkspaceDir", () => {
  it("returns workspace dir handle", async () => {
    const workspace = {};
    getGroupDir.mockResolvedValue({
      getDirectoryHandle: jest.fn().mockResolvedValue(workspace),
    });

    await expect(getWorkspaceDir({}, "g1")).resolves.toBe(workspace);
  });
});
