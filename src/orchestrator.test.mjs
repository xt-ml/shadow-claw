import { Orchestrator } from "./orchestrator.mjs";

describe("Orchestrator", () => {
  it("initializes defaults", () => {
    const o = new Orchestrator();
    expect(o.getState()).toBe("idle");
    expect(typeof o.getAssistantName()).toBe("string");
    expect(Array.isArray(o.getAvailableProviders())).toBe(true);
  });

  it("setState emits state-change event", () => {
    const o = new Orchestrator();
    const events = [];
    o.events.on("state-change", (state) => events.push(state));

    o.setState("thinking");

    expect(events).toEqual(["thinking"]);
    expect(o.getState()).toBe("thinking");
  });

  it("throws for unknown provider", async () => {
    const o = new Orchestrator();
    await expect(o.setProvider({}, "not-a-provider")).rejects.toThrow(
      "Unknown provider",
    );
  });

  it("emits open-file event from worker message", async () => {
    const o = new Orchestrator();
    const events = [];

    o.events.on("open-file", (payload) => events.push(payload));

    await o.handleWorkerMessage(
      {},
      { type: "open-file", payload: { groupId: "g1", path: "a.txt" } },
    );

    expect(events).toEqual([{ groupId: "g1", path: "a.txt" }]);
  });

  it("tracks vm status from worker messages", async () => {
    const o = new Orchestrator();
    const events = [];

    o.events.on("vm-status", (payload) => events.push(payload));

    await o.handleWorkerMessage(
      {},
      {
        type: "vm-status",
        payload: {
          ready: true,
          booting: false,
          bootAttempted: true,
          error: null,
        },
      },
    );

    expect(o.getVMStatus()).toEqual({
      ready: true,
      booting: false,
      bootAttempted: true,
      error: null,
    });
    expect(events).toHaveLength(1);
  });
});
