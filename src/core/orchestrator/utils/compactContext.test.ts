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

describe("compactContext", () => {
  let db: any;
  let o: Orchestrator;
  let compactContext: any;

  beforeEach(async () => {
    db = {} as any;
    const { Orchestrator: Orch } = await import("../orchestrator.js");
    o = new Orch();
    o.providerConfig = { requiresApiKey: false } as any;

    const mod = await import("./compactContext.js");
    compactContext = mod.compactContext;
  });

  it("emits error if requires API key and none is set", async () => {
    o.providerConfig = { requiresApiKey: true } as any;
    jest.spyOn(o, "getApiKeyForRequest").mockResolvedValue("");

    const events: any[] = [];
    o.events.on("error", (e: any) => events.push(e));

    await compactContext(o, db, "group-1");

    expect(events).toHaveLength(1);
    expect(events[0].error).toMatch(/API key not configured/);
  });

  it("emits error if state is not idle", async () => {
    jest.spyOn(o, "getApiKeyForRequest").mockResolvedValue("key");
    o.setState("thinking");

    const events: any[] = [];
    o.events.on("error", (e: any) => events.push(e));

    await compactContext(o, db, "group-1");

    expect(events).toHaveLength(1);
    expect(events[0].error).toMatch(/Cannot compact while processing/);
  });

  it("sends message to agentWorker", async () => {
    jest.spyOn(o, "getApiKeyForRequest").mockResolvedValue("key");
    const postMessage = jest.fn();
    o.agentWorker = { postMessage } as any;

    await compactContext(o, db, "group-1");

    expect(postMessage).toHaveBeenCalled();
    const payload: any = postMessage.mock.calls[0][0];
    expect(payload.type).toBe("compact");
    expect(payload.payload.groupId).toBe("group-1");
  });
});
