import { jest } from "@jest/globals";

jest.unstable_mockModule("./getRecentMessages.mjs", () => ({
  getRecentMessages: jest.fn(),
}));

describe("buildConversationMessages", () => {
  let buildConversationMessages;
  let getRecentMessages;

  beforeEach(async () => {
    const getRecentMessagesModule = await import("./getRecentMessages.mjs");
    getRecentMessages = getRecentMessagesModule.getRecentMessages;

    const buildModule = await import("./buildConversationMessages.mjs");
    buildConversationMessages = buildModule.buildConversationMessages;
  });

  it("should map messages to Claude API format", async () => {
    const mockMessages = [
      { isFromMe: false, sender: "User1", content: "Hello" },
      { isFromMe: true, sender: "Assistant", content: "Hi there!" },
    ];
    getRecentMessages.mockResolvedValue(mockMessages);

    const result = await buildConversationMessages("group1", 10);

    expect(result).toEqual([
      { role: "user", content: "User1: Hello" },
      { role: "assistant", content: "Hi there!" },
    ]);
  });
});
