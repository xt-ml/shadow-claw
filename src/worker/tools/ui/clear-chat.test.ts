import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: jest.fn(),
}));

const { executeClearChat } = await import("./clear-chat.js");
const { post } = await import("../../utils/post.js");

describe("executeClearChat", () => {
  it("posts clear-chat message and returns confirmation", () => {
    const result = executeClearChat("group-123");
    expect(result).toContain("Chat history cleared successfully");
    expect(post).toHaveBeenCalledWith({
      type: "clear-chat",
      payload: { groupId: "group-123" },
    });
  });
});
