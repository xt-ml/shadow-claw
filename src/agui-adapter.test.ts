import { AGUIAdapter } from "./agui-adapter.js";

function createMockEventBus() {
  const handlers = new Map<string, Set<Function>>();

  return {
    on(event: string, cb: Function) {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }

      handlers.get(event)!.add(cb);
    },
    off(event: string, cb: Function) {
      handlers.get(event)?.delete(cb);
    },
    emit(event: string, data: any) {
      const cbs = handlers.get(event);
      if (cbs) {
        for (const cb of cbs) {
          cb(data);
        }
      }
    },
  };
}

describe("AGUIAdapter", () => {
  let events: ReturnType<typeof createMockEventBus>;
  let adapter: AGUIAdapter;
  let dispatched: Array<{ groupId: string; event: any }>;
  let listener: EventListener;

  beforeEach(() => {
    events = createMockEventBus();
    adapter = new AGUIAdapter(events);
    dispatched = [];

    // Capture all AG-UI events dispatched on window
    listener = ((e: CustomEvent) => {
      dispatched.push(e.detail);
    }) as EventListener;
    window.addEventListener("shadow-claw-agui-event", listener);

    adapter.start();
  });

  afterEach(() => {
    adapter.stop();
    window.removeEventListener("shadow-claw-agui-event", listener);
  });

  it("emits RUN_STARTED and TEXT_MESSAGE_START on streaming-start", () => {
    events.emit("streaming-start", { groupId: "br:main" });

    expect(dispatched).toHaveLength(2);
    expect(dispatched[0].event.type).toBe("RUN_STARTED");
    expect(dispatched[0].groupId).toBe("br:main");
    expect(dispatched[1].event.type).toBe("TEXT_MESSAGE_START");
    expect(dispatched[1].event.role).toBe("assistant");
  });

  it("emits TEXT_MESSAGE_CONTENT on streaming-chunk", () => {
    events.emit("streaming-start", { groupId: "br:main" });
    dispatched = [];

    events.emit("streaming-chunk", { groupId: "br:main", text: "Hello " });
    events.emit("streaming-chunk", { groupId: "br:main", text: "world" });

    expect(dispatched).toHaveLength(2);
    expect(dispatched[0].event.type).toBe("TEXT_MESSAGE_CONTENT");
    expect(dispatched[0].event.delta).toBe("Hello ");
    expect(dispatched[1].event.delta).toBe("world");
  });

  it("emits TEXT_MESSAGE_END on streaming-end", () => {
    events.emit("streaming-start", { groupId: "br:main" });
    dispatched = [];

    events.emit("streaming-end", { groupId: "br:main" });

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].event.type).toBe("TEXT_MESSAGE_END");
  });

  it("emits RUN_FINISHED on streaming-done", () => {
    events.emit("streaming-start", { groupId: "br:main" });
    dispatched = [];

    events.emit("streaming-done", { groupId: "br:main" });

    // TEXT_MESSAGE_END (closing the open message) + RUN_FINISHED
    expect(dispatched).toHaveLength(2);
    expect(dispatched[0].event.type).toBe("TEXT_MESSAGE_END");
    expect(dispatched[1].event.type).toBe("RUN_FINISHED");
  });

  it("emits RUN_FINISHED without TEXT_MESSAGE_END if already closed", () => {
    events.emit("streaming-start", { groupId: "br:main" });
    events.emit("streaming-end", { groupId: "br:main" });
    dispatched = [];

    events.emit("streaming-done", { groupId: "br:main" });

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].event.type).toBe("RUN_FINISHED");
  });

  it("emits TOOL_CALL_START and TOOL_CALL_END on tool-activity", () => {
    events.emit("streaming-start", { groupId: "br:main" });
    dispatched = [];

    events.emit("tool-activity", {
      groupId: "br:main",
      tool: "read_file",
      status: "running",
    });

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].event.type).toBe("TOOL_CALL_START");
    expect(dispatched[0].event.toolCallName).toBe("read_file");

    dispatched = [];
    events.emit("tool-activity", {
      groupId: "br:main",
      tool: "read_file",
      status: "done",
    });

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].event.type).toBe("TOOL_CALL_END");
  });

  it("emits RUN_ERROR on streaming-error", () => {
    events.emit("streaming-start", { groupId: "br:main" });
    dispatched = [];

    events.emit("streaming-error", {
      groupId: "br:main",
      error: "Rate limited",
    });

    // TEXT_MESSAGE_END + RUN_ERROR
    expect(dispatched).toHaveLength(2);
    expect(dispatched[0].event.type).toBe("TEXT_MESSAGE_END");
    expect(dispatched[1].event.type).toBe("RUN_ERROR");
    expect(dispatched[1].event.message).toBe("Rate limited");
  });

  it("ignores streaming-chunk without a prior streaming-start", () => {
    events.emit("streaming-chunk", { groupId: "br:main", text: "orphan" });

    expect(dispatched).toHaveLength(0);
  });

  it("stop() unsubscribes all handlers", () => {
    adapter.stop();

    events.emit("streaming-start", { groupId: "br:main" });
    expect(dispatched).toHaveLength(0);
  });

  it("tracks independent runs per groupId", () => {
    events.emit("streaming-start", { groupId: "br:main" });
    events.emit("streaming-start", { groupId: "peer:abc" });
    dispatched = [];

    events.emit("streaming-chunk", { groupId: "br:main", text: "A" });
    events.emit("streaming-chunk", { groupId: "peer:abc", text: "B" });

    expect(dispatched).toHaveLength(2);
    expect(dispatched[0].groupId).toBe("br:main");
    expect(dispatched[0].event.delta).toBe("A");
    expect(dispatched[1].groupId).toBe("peer:abc");
    expect(dispatched[1].event.delta).toBe("B");
  });
});
