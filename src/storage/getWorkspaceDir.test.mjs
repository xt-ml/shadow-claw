import { jest } from "@jest/globals";

import { getWorkspaceDir } from "./getWorkspaceDir.mjs";

describe("getWorkspaceDir", () => {
  it("returns workspace dir handle", async () => {
    const workspace = {};
    globalThis.getGroupDir = jest.fn().mockResolvedValue({
      getDirectoryHandle: jest.fn().mockResolvedValue(workspace),
    });

    await expect(getWorkspaceDir({}, "g1")).resolves.toBe(workspace);
  });
});
