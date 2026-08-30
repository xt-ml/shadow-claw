import { jest } from "@jest/globals";

import type { Orchestrator } from "../orchestrator.js";

jest.unstable_mockModule("../../../storage/readGroupFile.js", () => ({
  readGroupFile: jest.fn<any>().mockRejectedValue(new Error("no file")),
}));

jest.unstable_mockModule("../../../db/buildConversationMessages.js", () => ({
  buildConversationMessages: jest.fn<any>().mockResolvedValue([]),
}));

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue(null),
}));

jest.unstable_mockModule("../../../db/saveMessage.js", () => ({
  saveMessage: jest.fn<any>().mockResolvedValue(1),
}));

jest.unstable_mockModule("../../../db/groups.js", () => ({
  getGroupMetadata: jest.fn<any>().mockResolvedValue([]),
  saveGroupMetadata: jest.fn<any>().mockResolvedValue(undefined),
  createGroup: jest.fn<any>().mockResolvedValue({} as any),
  renameGroup: jest.fn<any>().mockResolvedValue(undefined),
  updateGroupToolTags: jest.fn<any>().mockResolvedValue(undefined),
  deleteGroupMetadata: jest.fn<any>().mockResolvedValue(undefined),
  listGroups: jest.fn<any>().mockResolvedValue([
    {
      groupId: "group-pinned",
      pinnedProvider: "transformers_js_local",
      pinnedModel: "onnx-community/Llama-3.2-1B-Instruct",
    },
  ]),
  reorderGroups: jest.fn<any>().mockResolvedValue(undefined),
  cloneGroup: jest.fn<any>().mockResolvedValue({} as any),
  updateGroupPinnedProvider: jest.fn<any>().mockResolvedValue(undefined),
  updateGroupSubagentSettings: jest.fn<any>().mockResolvedValue(undefined),
  updateGroupProviderRuntimeOverrides: jest
    .fn<any>()
    .mockResolvedValue(undefined),
}));

jest.unstable_mockModule(
  "../../../subsystems/providers/builtin-ai-tasks.js",
  () => ({
    ensureBuiltinAiPolyfills: jest.fn<any>().mockResolvedValue(undefined),
    summarizeText: jest
      .fn<any>()
      .mockResolvedValue("Mock summary from Task API"),
    writeText: jest.fn<any>().mockResolvedValue(""),
    rewriteText: jest.fn<any>().mockResolvedValue(""),
    detectLanguage: jest.fn<any>().mockResolvedValue([]),
    translateText: jest.fn<any>().mockResolvedValue(""),
    proofreadText: jest.fn<any>().mockResolvedValue(""),
    embedText: jest.fn<any>().mockResolvedValue([]),
    isBuiltinTaskSupported: jest.fn(() => true),
    getPromptApiFallbackModel: jest.fn<any>().mockResolvedValue(""),
    createTaskInstanceWithFallback: jest.fn<any>().mockResolvedValue({}),
    isWebGpuAdapterAvailable: jest.fn<any>().mockResolvedValue(false),
  }),
);

jest.unstable_mockModule(
  "../../../subsystems/providers/prompt-api-provider.js",
  () => ({
    isPromptApiSupported: jest.fn<any>().mockReturnValue(true),
    compactWithPromptApi: jest
      .fn<any>()
      .mockResolvedValue("Mock prompt API summary"),
    invokeWithPromptApi: jest.fn<any>().mockResolvedValue(undefined),
  }),
);

describe("compactContext", () => {
  let db: any;
  let o: Orchestrator;
  let compactContext: any;

  beforeEach(async () => {
    db = {} as any;
    const { Orchestrator: Orch } = await import("../orchestrator.js");
    o = new Orch();
    o.provider = "openrouter";
    o.providerConfig = { requiresApiKey: false } as any;

    const mod = await import("./compactContext.js");
    compactContext = mod.compactContext;
  });

  it("emits error if requires API key and none is set", async () => {
    o.provider = "openrouter";
    o.providerConfig = { requiresApiKey: true } as any;
    jest.spyOn(o, "getApiKey").mockResolvedValue("");

    const events: any[] = [];
    o.events.on("error", (e: any) => events.push(e));

    await compactContext(o, db, "group-1");

    expect(events).toHaveLength(1);
    expect(events[0].error).toMatch(/API key not configured/);
  });

  it("emits error if state is not idle", async () => {
    jest.spyOn(o, "getApiKey").mockResolvedValue("key");
    o.setState("thinking");

    const events: any[] = [];
    o.events.on("error", (e: any) => events.push(e));

    await compactContext(o, db, "group-1");

    expect(events).toHaveLength(1);
    expect(events[0].error).toMatch(/Cannot compact while processing/);
  });

  it("sends message to agentWorker", async () => {
    jest.spyOn(o, "getApiKey").mockResolvedValue("key");
    const postMessage = jest.fn();
    o.agentWorker = { postMessage } as any;

    await compactContext(o, db, "group-1");

    expect(postMessage).toHaveBeenCalled();
    const payload: any = postMessage.mock.calls[0][0];
    expect(payload.type).toBe("compact");
    expect(payload.payload.groupId).toBe("group-1");
  });

  it("uses effective provider and model when group has pinned provider", async () => {
    jest.spyOn(o, "getApiKey").mockResolvedValue("key");
    const postMessage = jest.fn();
    o.agentWorker = { postMessage } as any;

    o.provider = "openrouter";
    o.model = "gpt-4o";

    await compactContext(o, db, "group-pinned");

    expect(postMessage).toHaveBeenCalled();
    const payload: any = postMessage.mock.calls[0][0];
    expect(payload.type).toBe("compact");
    expect(payload.payload.provider).toBe("transformers_js_local");
    expect(payload.payload.model).toBe("onnx-community/Llama-3.2-1B-Instruct");
  });

  it("handles compactionPref === 'builtin_task_api'", async () => {
    jest.spyOn(o, "getApiKey").mockResolvedValue("key");
    const { getConfig } = await import("../../../db/getConfig.js");
    (getConfig as jest.Mock<any>).mockImplementation(
      (_db: any, key: string) => {
        if (key === "compaction_engine_preference") {
          return Promise.resolve("builtin_task_api");
        }
        return Promise.resolve(null);
      },
    );

    const { buildConversationMessages } =
      await import("../../../db/buildConversationMessages.js");
    (buildConversationMessages as jest.Mock<any>).mockResolvedValue([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello" },
    ]);

    o.handleCompactDone = jest.fn<any>().mockResolvedValue(undefined);

    await compactContext(o, db, "group-1");

    expect(o.handleCompactDone).toHaveBeenCalledWith(
      db,
      "group-1",
      "Mock summary from Task API",
    );
  });

  it("handles effectiveProviderId === 'prompt_api'", async () => {
    const { getConfig } = await import("../../../db/getConfig.js");
    (getConfig as jest.Mock<any>).mockResolvedValue(null);

    o.provider = "prompt_api";
    o.providerConfig = { requiresApiKey: false } as any;
    o.handleCompactDone = jest.fn<any>().mockResolvedValue(undefined);

    await compactContext(o, db, "group-1");

    expect(o.handleCompactDone).toHaveBeenCalledWith(
      db,
      "group-1",
      "Mock prompt API summary",
    );
  });
});
