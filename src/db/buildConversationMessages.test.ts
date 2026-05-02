import { jest } from "@jest/globals";

jest.unstable_mockModule("./getRecentMessages.js", () => ({
  getRecentMessages: jest.fn(),
}));

jest.unstable_mockModule("./db.js", () => ({
  getDb: jest.fn(),
}));

jest.unstable_mockModule("../storage/readGroupFileBytes.js", () => ({
  readGroupFileBytes: jest.fn(),
}));

describe("buildConversationMessages", () => {
  let buildConversationMessages;
  let getRecentMessages;
  let getDb;
  let readGroupFileBytes;

  beforeEach(async () => {
    const getRecentMessagesModule = await import("./getRecentMessages.js");
    getRecentMessages = getRecentMessagesModule.getRecentMessages;
    const dbModule = await import("./db.js");
    getDb = dbModule.getDb;
    const readBytesModule = await import("../storage/readGroupFileBytes.js");
    readGroupFileBytes = readBytesModule.readGroupFileBytes;

    const buildModule = await import("./buildConversationMessages.js");
    buildConversationMessages = buildModule.buildConversationMessages;
  });

  it("should map messages to Claude API format", async () => {
    const mockMessages = [
      { isFromMe: false, sender: "User1", content: "Hello" },
      { isFromMe: true, sender: "Assistant", content: "Hi there!" },
    ];
    (getRecentMessages as any).mockResolvedValue(mockMessages);

    const result = await buildConversationMessages("group1", 10);

    expect(result).toEqual([
      { role: "user", content: "User1: Hello" },
      { role: "assistant", content: "Hi there!" },
    ]);
  });

  it("should append structured image attachment blocks for user messages", async () => {
    (getDb as any).mockResolvedValue({});
    (readGroupFileBytes as any).mockResolvedValue(
      new Uint8Array([112, 110, 103]),
    );
    (getRecentMessages as any).mockResolvedValue([
      {
        isFromMe: false,
        sender: "User1",
        content: "See attachment",
        attachments: [
          {
            fileName: "photo.png",
            mimeType: "image/png",
            size: 3,
            path: "attachments/photo.png",
          },
        ],
      },
    ]);

    const result = await buildConversationMessages("group1", 10);

    expect(result).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "User1: See attachment" },
          {
            type: "attachment",
            mediaType: "image",
            fileName: "photo.png",
            mimeType: "image/png",
            size: 3,
            path: "attachments/photo.png",
            data: "cG5n",
          },
        ],
      },
    ]);
  });
});
