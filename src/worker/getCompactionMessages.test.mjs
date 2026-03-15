import { getCompactionMessages } from "./getCompactionMessages.mjs";

describe("getCompactionMessages", () => {
  it("appends a compaction request message", () => {
    const base = [{ role: "assistant", content: "hello" }];

    const result = getCompactionMessages(base);

    expect(result).toHaveLength(2);

    expect(result[0]).toEqual(base[0]);

    expect(result[1]).toEqual(
      expect.objectContaining({
        role: "user",
        content: expect.stringContaining("concise summary"),
      }),
    );
  });
});
