import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: jest.fn(),
}));

const { executeManageTools } = await import("./manage-tools.js");
const { post } = await import("../../utils/post.js");

describe("executeManageTools", () => {
  it("posts manage-tools message with action and tool details", () => {
    const result = executeManageTools(
      {
        action: "enable",
        tool_names: ["git_status", "git_commit"],
        profile_id: "git-dev",
      },
      "group-456",
    );

    expect(result).toContain(
      "Tool management request sent: enable git-dev (git_status, git_commit)",
    );
    expect(post).toHaveBeenCalledWith({
      type: "manage-tools",
      payload: {
        action: "enable",
        groupId: "group-456",
        profileId: "git-dev",
        toolNames: ["git_status", "git_commit"],
      },
    });
  });
});
