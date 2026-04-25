import { jest } from "@jest/globals";

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: jest.fn(),
}));

const { getWorkspaceDir } = await import("./getWorkspaceDir.js");
const { getGroupDir } = await import("./getGroupDir.js");

describe("getWorkspaceDir", () => {
  it("returns workspace dir handle", async () => {
    const workspace: any = {};

    (getGroupDir as any).mockResolvedValue({
      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(workspace),
    });

    await expect(getWorkspaceDir({} as any, "g1")).resolves.toBe(workspace);
  });
});
