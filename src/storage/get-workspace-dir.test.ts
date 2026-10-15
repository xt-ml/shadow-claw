import { jest } from "@jest/globals";

jest.unstable_mockModule("./get-group-dir.js", () => ({
  getGroupDir: jest.fn(),
}));

const { getWorkspaceDir } = await import("./get-workspace-dir.js");
const { getGroupDir } = await import("./get-group-dir.js");

describe("getWorkspaceDir", () => {
  it("returns workspace dir handle", async () => {
    const workspace: any = {};

    (getGroupDir as any).mockResolvedValue({
      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(workspace),
    });

    await expect(getWorkspaceDir({} as any, "g1")).resolves.toBe(workspace);
  });
});
