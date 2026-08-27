import { jest } from "@jest/globals";

const mockSetConfig = jest.fn().mockResolvedValue(undefined as never);

jest.unstable_mockModule("../../../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

const { persistChatSplitHeight } = await import("./persistChatSplitHeight.js");

describe("persistChatSplitHeight", () => {
  it("should do nothing if db is undefined", async () => {
    await expect(
      persistChatSplitHeight(undefined as any, 300),
    ).resolves.toBeUndefined();
  });

  it("should set config in IndexedDB", async () => {
    const mockDb = {} as any;
    await persistChatSplitHeight(mockDb, 350);
    expect(mockSetConfig).toHaveBeenCalledWith(
      mockDb,
      "chat_split_view_height",
      350,
    );
  });
});
