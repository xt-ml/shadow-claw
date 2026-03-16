import { jest } from "@jest/globals";

describe("prompt-api-provider", () => {
  /**
   * @param {jest.Mock} createMock
   * @param {jest.Mock} [availabilityMock]
   *
   * @returns {void}
   */
  function setLanguageModelMock(
    createMock,
    availabilityMock = jest.fn().mockResolvedValue("available"),
  ) {
    const LanguageModel = /** @type {any} */ (function LanguageModel() {});
    LanguageModel.availability = availabilityMock;
    LanguageModel.create = createMock;
    globalThis.LanguageModel = LanguageModel;
  }

  beforeEach(() => {
    jest.resetModules();
    delete globalThis.LanguageModel;
  });

  afterEach(async () => {
    try {
      const mod = await import("./prompt-api-provider.mjs");
      await mod.__resetPromptApiSessionCacheForTests();
    } catch {
      // Ignore cleanup errors in tests that never loaded the module.
    }

    delete globalThis.LanguageModel;
  });

  it("reuses one warm session and clones per request", async () => {
    const clonePrompt = jest.fn().mockResolvedValue("summary");
    const cloneDestroy = jest.fn().mockResolvedValue(undefined);
    const baseClone = jest.fn(async () => ({
      prompt: clonePrompt,
      destroy: cloneDestroy,
    }));
    const baseDestroy = jest.fn().mockResolvedValue(undefined);

    const createMock = jest.fn(async () => ({
      clone: baseClone,
      destroy: baseDestroy,
    }));
    setLanguageModelMock(createMock);

    const { compactWithPromptApi } = await import("./prompt-api-provider.mjs");

    const first = await compactWithPromptApi("You are concise.", [
      { role: "user", content: "hello" },
    ]);
    const second = await compactWithPromptApi("You are concise.", [
      { role: "user", content: "hello again" },
    ]);

    expect(first).toBe("summary");
    expect(second).toBe("summary");

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(baseClone).toHaveBeenCalledTimes(2);
    expect(clonePrompt).toHaveBeenCalledTimes(2);
    expect(cloneDestroy).toHaveBeenCalledTimes(2);
    expect(baseDestroy).not.toHaveBeenCalled();

    const promptArg = clonePrompt.mock.calls[0][0];
    expect(promptArg).toContain("CONVERSATION:");
    expect(promptArg).not.toContain("SYSTEM INSTRUCTIONS:");
  });

  it("falls back to warm session when clone is unavailable", async () => {
    const warmPrompt = jest.fn().mockResolvedValue("summary");
    const warmDestroy = jest.fn().mockResolvedValue(undefined);

    const createMock = jest.fn(async () => ({
      prompt: warmPrompt,
      destroy: warmDestroy,
    }));
    setLanguageModelMock(createMock);

    const { compactWithPromptApi } = await import("./prompt-api-provider.mjs");

    await compactWithPromptApi("System", [{ role: "user", content: "one" }]);
    await compactWithPromptApi("System", [{ role: "user", content: "two" }]);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(warmPrompt).toHaveBeenCalledTimes(2);
    expect(warmDestroy).not.toHaveBeenCalled();
  });

  it("resets and destroys the cached warm session", async () => {
    const warmPrompt = jest.fn().mockResolvedValue("summary");
    const warmDestroy = jest.fn().mockResolvedValue(undefined);

    const createMock = jest.fn(async () => ({
      prompt: warmPrompt,
      destroy: warmDestroy,
    }));
    setLanguageModelMock(createMock);

    const { compactWithPromptApi, __resetPromptApiSessionCacheForTests } =
      await import("./prompt-api-provider.mjs");

    await compactWithPromptApi("System", [{ role: "user", content: "one" }]);
    await __resetPromptApiSessionCacheForTests();

    expect(warmDestroy).toHaveBeenCalledTimes(1);
  });
});
