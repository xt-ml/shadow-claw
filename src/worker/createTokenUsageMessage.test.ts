import { createTokenUsageMessage } from "./createTokenUsageMessage.js";

describe("createTokenUsageMessage", () => {
  it("maps provider usage fields", () => {
    const msg = createTokenUsageMessage(
      "g",
      {
        input_tokens: 1,
        output_tokens: 2,
        cache_read_input_tokens: 3,
        cache_creation_input_tokens: 4,
      },
      10,
    );

    expect(msg).toEqual({
      type: "token-usage",
      payload: {
        groupId: "g",
        inputTokens: 1,
        outputTokens: 2,
        cacheReadTokens: 3,
        cacheCreationTokens: 4,
        contextLimit: 10,
      },
    });
  });
});
