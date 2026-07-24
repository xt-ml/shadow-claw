import { jest } from "@jest/globals";
import { resolveSharedFilesConversationId } from "./resolveSharedFilesConversationId.js";

describe("resolveSharedFilesConversationId", () => {
  let mockOStore: any;
  let db: any;

  beforeEach(() => {
    db = {};
    mockOStore = {
      groups: [],
      switchConversation: jest.fn(),
      createConversation: jest.fn(),
    };
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should return existing conversation id if it exists", async () => {
    jest.setSystemTime(new Date("2026-07-23T12:00:00Z"));

    mockOStore.groups = [
      { name: "Other", groupId: "1" },
      { name: "Shared Files 2026-07-23", groupId: "2" },
    ];

    const result = await resolveSharedFilesConversationId(db, mockOStore);

    expect(result).toBe("2");
    expect(mockOStore.switchConversation).toHaveBeenCalledWith(db, "2");
    expect(mockOStore.createConversation).not.toHaveBeenCalled();
  });

  it("should create new conversation if it does not exist", async () => {
    jest.setSystemTime(new Date("2026-07-23T12:00:00Z"));

    mockOStore.groups = [{ name: "Other", groupId: "1" }];
    mockOStore.createConversation.mockResolvedValue({ groupId: "3" });

    const result = await resolveSharedFilesConversationId(db, mockOStore);

    expect(result).toBe("3");
    expect(mockOStore.createConversation).toHaveBeenCalledWith(
      db,
      "Shared Files 2026-07-23",
    );
    expect(mockOStore.switchConversation).not.toHaveBeenCalled();
  });
});
