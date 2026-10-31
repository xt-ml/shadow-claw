import { isPromptApiSupported } from "./is-prompt-api-supported.js";

describe("isPromptApiSupported", () => {
  const origLanguageModel = (globalThis as any).LanguageModel;

  afterEach(() => {
    if (origLanguageModel === undefined) {
      delete (globalThis as any).LanguageModel;
    } else {
      (globalThis as any).LanguageModel = origLanguageModel;
    }
  });

  it("returns false when LanguageModel is undefined", () => {
    delete (globalThis as any).LanguageModel;
    expect(isPromptApiSupported()).toBe(false);
  });

  it("returns false when LanguageModel is not a function", () => {
    (globalThis as any).LanguageModel = {};
    expect(isPromptApiSupported()).toBe(false);
  });

  it("returns false when LanguageModel does not have availability or create methods", () => {
    (globalThis as any).LanguageModel = function () {};
    expect(isPromptApiSupported()).toBe(false);
  });

  it("returns true when LanguageModel has availability and create methods", () => {
    const mockLm = function () {};
    mockLm.availability = () => {};
    mockLm.create = () => {};
    (globalThis as any).LanguageModel = mockLm;
    expect(isPromptApiSupported()).toBe(true);
  });
});
