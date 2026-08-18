import { beforeEach, describe, expect, it, jest } from "@jest/globals";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockHandleInvoke = jest.fn() as jest.MockedFunction<any>;
const mockInvokeWithTransformersJs = jest.fn() as jest.MockedFunction<any>;
const mockInvokeWithPromptApi = jest.fn() as jest.MockedFunction<any>;
const mockIsPromptApiSupported = jest.fn() as jest.MockedFunction<any>;
const mockInvokeWithLiteRtLm = jest.fn() as jest.MockedFunction<any>;
const mockIsLiteRtLmSupported = jest.fn() as jest.MockedFunction<any>;
const mockWorkerPost = jest.fn() as jest.MockedFunction<any>;

jest.unstable_mockModule("../../../worker/utils/handleInvoke.js", () => ({
  handleInvoke: mockHandleInvoke,
}));

jest.unstable_mockModule(
  "../../../subsystems/providers/transformers-js-provider.js",
  () => ({
    invokeWithTransformersJs: mockInvokeWithTransformersJs,
  }),
);

jest.unstable_mockModule(
  "../../../subsystems/providers/prompt-api-provider.js",
  () => ({
    invokeWithPromptApi: mockInvokeWithPromptApi,
    isPromptApiSupported: mockIsPromptApiSupported,
  }),
);

jest.unstable_mockModule(
  "../../../subsystems/providers/litert-lm-provider.js",
  () => ({
    invokeWithLiteRtLm: mockInvokeWithLiteRtLm,
    isLiteRtLmSupported: mockIsLiteRtLmSupported,
  }),
);

jest.unstable_mockModule("../../../worker/utils/post.js", () => ({
  post: mockWorkerPost,
}));

const { dispatchSubagentInvoke, isBrowserProviderId } =
  await import("./dispatchSubagentInvoke.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, any> = {}) {
  return {
    groupId: "group1",
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    systemPrompt: "You are a helpful assistant.",
    messages: [{ role: "user" as const, content: "Hello" }],
    maxTokens: 1024,
    apiKey: "test-key",
    assistantName: "Assistant",
    memory: "",
    streaming: false,
    enabledTools: [{ name: "tool_a" }, { name: "tool_b" }],
    ...overrides,
  } as any;
}

const mockDb = {} as any;

// ── isBrowserProviderId ───────────────────────────────────────────────────────

describe("isBrowserProviderId", () => {
  it("returns true for transformers_js_browser (with 's')", () => {
    // Bug: the original code had 'transformer_js_browser' (missing 's') in the
    // BROWSER_PROVIDER_IDS set, so this would have returned false.
    expect(isBrowserProviderId("transformers_js_browser")).toBe(true);
  });

  it("returns false for the misspelled 'transformer_js_browser' (no 's')", () => {
    // This is the misspelled version that was in the set before the fix.
    // It must NOT be treated as a browser provider.
    expect(isBrowserProviderId("transformer_js_browser")).toBe(false);
  });

  it("returns true for prompt_api", () => {
    expect(isBrowserProviderId("prompt_api")).toBe(true);
  });

  it("returns true for litert_lm_browser", () => {
    expect(isBrowserProviderId("litert_lm_browser")).toBe(true);
  });

  it("returns false for standard remote providers", () => {
    expect(isBrowserProviderId("anthropic")).toBe(false);
    expect(isBrowserProviderId("openai")).toBe(false);
    expect(isBrowserProviderId("transformers_js_local")).toBe(false);
    expect(isBrowserProviderId(undefined)).toBe(false);
  });
});

// ── dispatchSubagentInvoke ────────────────────────────────────────────────────

describe("dispatchSubagentInvoke", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleInvoke.mockResolvedValue(undefined);
    mockInvokeWithTransformersJs.mockResolvedValue(undefined);
    mockInvokeWithPromptApi.mockResolvedValue(undefined);
    mockInvokeWithLiteRtLm.mockResolvedValue(undefined);
    mockIsPromptApiSupported.mockReturnValue(true);
    mockIsLiteRtLmSupported.mockReturnValue(true);
  });

  // ── Default (worker) path ─────────────────────────────────────────────────

  it("delegates to handleInvoke for a standard remote provider", async () => {
    const payload = makePayload({ provider: "anthropic" });
    await dispatchSubagentInvoke(mockDb, payload);

    expect(mockHandleInvoke).toHaveBeenCalledWith(mockDb, payload, undefined);
    expect(mockInvokeWithTransformersJs).not.toHaveBeenCalled();
    expect(mockInvokeWithPromptApi).not.toHaveBeenCalled();
    expect(mockInvokeWithLiteRtLm).not.toHaveBeenCalled();
  });

  it("passes through abortSignal to handleInvoke", async () => {
    const signal = new AbortController().signal;
    const payload = makePayload({ provider: "openai" });
    await dispatchSubagentInvoke(mockDb, payload, signal);

    expect(mockHandleInvoke).toHaveBeenCalledWith(mockDb, payload, signal);
  });

  // ── transformers_js_browser path ──────────────────────────────────────────

  it("routes transformers_js_browser to invokeWithTransformersJs", async () => {
    const payload = makePayload({
      provider: "transformers_js_browser",
      model: "onnx-community/Qwen3-0.6B-ONNX",
    });
    await dispatchSubagentInvoke(mockDb, payload);

    expect(mockInvokeWithTransformersJs).toHaveBeenCalledTimes(1);
    expect(mockHandleInvoke).not.toHaveBeenCalled();
  });

  /**
   * Bug regression: before the fix the model and tools arguments were swapped.
   * invokeWithTransformersJs signature (positional):
   *   (db, groupId, systemPrompt, messages, maxTokens, emit, abortSignal, tools, modelId)
   *
   * The bug introduced `payload.model` in position 8 (tools) and
   * `payload.enabledTools` in position 9 (modelId), so the model string was
   * passed as the tools array and an array was passed as the model ID.
   */
  it("passes model and enabledTools in the correct positional order to invokeWithTransformersJs", async () => {
    const tools = [{ name: "web_search" }, { name: "read_file" }];
    const payload = makePayload({
      provider: "transformers_js_browser",
      model: "onnx-community/Qwen3-0.6B-ONNX",
      enabledTools: tools,
    });

    await dispatchSubagentInvoke(mockDb, payload);

    expect(mockInvokeWithTransformersJs).toHaveBeenCalledTimes(1);
    const callArgs = mockInvokeWithTransformersJs.mock.calls[0] as any[];

    // Arg 7 (0-indexed) is `tools`  — must be the array, not a string
    const toolsArg = callArgs[7];
    expect(Array.isArray(toolsArg)).toBe(true);
    expect(toolsArg).toEqual(tools);

    // Arg 8 (0-indexed) is `modelId` — must be the string, not an array
    const modelArg = callArgs[8];
    expect(typeof modelArg).toBe("string");
    expect(modelArg).toBe("onnx-community/Qwen3-0.6B-ONNX");
  });

  it("passes the abort signal to invokeWithTransformersJs", async () => {
    const controller = new AbortController();
    const payload = makePayload({ provider: "transformers_js_browser" });
    await dispatchSubagentInvoke(mockDb, payload, controller.signal);

    const callArgs = mockInvokeWithTransformersJs.mock.calls[0] as any[];
    // Arg 6 (0-indexed) is `abortSignal`
    expect(callArgs[6]).toBe(controller.signal);
  });

  // ── prompt_api path ───────────────────────────────────────────────────────

  it("routes prompt_api to invokeWithPromptApi when supported", async () => {
    const payload = makePayload({ provider: "prompt_api" });
    await dispatchSubagentInvoke(mockDb, payload);

    expect(mockInvokeWithPromptApi).toHaveBeenCalledTimes(1);
    expect(mockHandleInvoke).not.toHaveBeenCalled();
  });

  it("throws when prompt_api is not supported", async () => {
    mockIsPromptApiSupported.mockReturnValue(false);
    const payload = makePayload({ provider: "prompt_api" });

    await expect(dispatchSubagentInvoke(mockDb, payload)).rejects.toThrow(
      /not supported/,
    );
  });

  // ── litert_lm_browser path ────────────────────────────────────────────────

  it("routes litert_lm_browser to invokeWithLiteRtLm when supported", async () => {
    const payload = makePayload({ provider: "litert_lm_browser" });
    await dispatchSubagentInvoke(mockDb, payload);

    expect(mockInvokeWithLiteRtLm).toHaveBeenCalledTimes(1);
    expect(mockHandleInvoke).not.toHaveBeenCalled();
  });

  it("throws when litert_lm_browser is not supported", async () => {
    mockIsLiteRtLmSupported.mockReturnValue(false);
    const payload = makePayload({ provider: "litert_lm_browser" });

    await expect(dispatchSubagentInvoke(mockDb, payload)).rejects.toThrow(
      /not supported/,
    );
  });

  it("passes model and tools in the correct positional order to invokeWithLiteRtLm", async () => {
    const tools = [{ name: "bash" }];
    const payload = makePayload({
      provider: "litert_lm_browser",
      model: "litert-community/gemma-4-E2B-it-litert-lm",
      enabledTools: tools,
    });

    await dispatchSubagentInvoke(mockDb, payload);

    expect(mockInvokeWithLiteRtLm).toHaveBeenCalledTimes(1);
    const callArgs = mockInvokeWithLiteRtLm.mock.calls[0] as any[];

    // invokeWithLiteRtLm(db, groupId, systemPrompt, messages, maxTokens, emit, abortSignal, modelId, tools)
    // Arg 7 is modelId — must be a string
    const modelArg = callArgs[7];
    expect(typeof modelArg).toBe("string");
    expect(modelArg).toBe("litert-community/gemma-4-E2B-it-litert-lm");

    // Arg 8 is tools — must be the array
    const toolsArg = callArgs[8];
    expect(Array.isArray(toolsArg)).toBe(true);
    expect(toolsArg).toEqual(tools);
  });
});
