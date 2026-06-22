import { jest } from "@jest/globals";

import {
  PeerTaskManager,
  type TaskEvent,
  type TaskEventListener,
} from "./peer-task-manager.js";

import {
  TaskState,
  Role,
  type A2AMessage,
  type SendMessageRequest,
} from "./peer-protocol.js";

// Mock ulid to produce deterministic IDs
let ulidCounter = 0;
jest.unstable_mockModule("../utils/ulid.js", () => ({
  ulid: () => `TEST_ULID_${++ulidCounter}`,
}));

describe("PeerTaskManager", () => {
  let manager: PeerTaskManager;
  let events: TaskEvent[];
  let listener: TaskEventListener;

  beforeEach(() => {
    ulidCounter = 0;
    manager = new PeerTaskManager({ maxTasks: 10, maxHistoryPerTask: 5 });
    events = [];
    listener = (event) => events.push(event);
    manager.on(listener);
  });

  afterEach(() => {
    manager.off(listener);
    manager.clear();
  });

  function makeMessage(text: string, opts?: Partial<A2AMessage>): A2AMessage {
    return {
      messageId: `msg_${++ulidCounter}`,
      role: Role.USER,
      parts: [{ text }],
      ...opts,
    };
  }

  function makeRequest(
    text: string,
    opts?: Partial<SendMessageRequest["message"]>,
  ): SendMessageRequest {
    return {
      message: makeMessage(text, opts),
    };
  }

  describe("task creation", () => {
    it("creates a new task on first SendMessage without taskId", () => {
      const response = manager.handleSendMessage(makeRequest("Hello"));

      expect(response.task).toBeDefined();
      expect(response.task!.status.state).toBe(TaskState.SUBMITTED);
      expect(response.task!.contextId).toBeDefined();
      expect(response.task!.history).toHaveLength(1);
    });

    it("assigns a contextId from the message if provided", () => {
      const msg = makeMessage("Hello", { contextId: "ctx_1" });
      const response = manager.handleSendMessage({ message: msg });

      expect(response.task!.contextId).toBe("ctx_1");
    });

    it("emits a statusUpdate event on task creation", () => {
      manager.handleSendMessage(makeRequest("Hello"));

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("statusUpdate");
      expect((events[0].payload as any).status.state).toBe(TaskState.SUBMITTED);
    });
  });

  describe("task continuation", () => {
    it("continues existing task via contextId", () => {
      const msg1 = makeMessage("First", { contextId: "ctx_A" });
      const r1 = manager.handleSendMessage({ message: msg1 });
      const taskId = r1.task!.id;

      const msg2 = makeMessage("Second", { contextId: "ctx_A" });
      const r2 = manager.handleSendMessage({ message: msg2 });

      expect(r2.task!.id).toBe(taskId);
      expect(r2.task!.history).toHaveLength(2);
    });

    it("continues existing task via explicit taskId", () => {
      const msg1 = makeMessage("First", { contextId: "ctx_B" });
      const r1 = manager.handleSendMessage({ message: msg1 });
      const taskId = r1.task!.id;

      const msg2 = makeMessage("Second", { taskId, contextId: "ctx_B" });
      const r2 = manager.handleSendMessage({ message: msg2 });

      expect(r2.task!.id).toBe(taskId);
    });

    it("trims history to maxHistoryPerTask", () => {
      const msg1 = makeMessage("1", { contextId: "ctx_C" });
      manager.handleSendMessage({ message: msg1 });

      for (let i = 2; i <= 7; i++) {
        const msg = makeMessage(`${i}`, { contextId: "ctx_C" });
        manager.handleSendMessage({ message: msg });
      }

      const task = manager.getActiveTaskForContext("ctx_C");
      expect(task!.history!.length).toBeLessThanOrEqual(5);
    });

    it("transitions from INPUT_REQUIRED back to WORKING on continuation", () => {
      const msg1 = makeMessage("Start", { contextId: "ctx_D" });
      const r1 = manager.handleSendMessage({ message: msg1 });
      const taskId = r1.task!.id;

      manager.markWorking(taskId);
      manager.markInputRequired(taskId);

      const task = manager.getTask(taskId)!;
      expect(task.status.state).toBe(TaskState.INPUT_REQUIRED);

      const msg2 = makeMessage("Here is my input", { contextId: "ctx_D" });
      manager.handleSendMessage({ message: msg2 });

      expect(manager.getTask(taskId)!.status.state).toBe(TaskState.WORKING);
    });
  });

  describe("state transitions", () => {
    it("SUBMITTED → WORKING → COMPLETED", () => {
      const r = manager.handleSendMessage(makeRequest("Do something"));
      const taskId = r.task!.id;

      manager.markWorking(taskId);
      expect(manager.getTask(taskId)!.status.state).toBe(TaskState.WORKING);

      manager.markCompleted(taskId);
      expect(manager.getTask(taskId)!.status.state).toBe(TaskState.COMPLETED);
    });

    it("SUBMITTED → WORKING → FAILED", () => {
      const r = manager.handleSendMessage(makeRequest("Fail"));
      const taskId = r.task!.id;

      manager.markWorking(taskId);
      manager.markFailed(taskId, "Something went wrong");

      const task = manager.getTask(taskId)!;
      expect(task.status.state).toBe(TaskState.FAILED);
      expect(task.status.message!.parts[0]).toEqual({
        text: "Something went wrong",
      });
    });

    it("rejects invalid transitions", () => {
      const r = manager.handleSendMessage(makeRequest("Invalid"));
      const taskId = r.task!.id;

      // SUBMITTED → COMPLETED is not valid (must go through WORKING)
      manager.markCompleted(taskId);
      expect(manager.getTask(taskId)!.status.state).toBe(TaskState.SUBMITTED);
    });

    it("cannot transition from terminal states", () => {
      const r = manager.handleSendMessage(makeRequest("Terminal"));
      const taskId = r.task!.id;

      manager.markWorking(taskId);
      manager.markCompleted(taskId);

      // Try to transition again — should be rejected
      manager.markWorking(taskId);
      expect(manager.getTask(taskId)!.status.state).toBe(TaskState.COMPLETED);
    });
  });

  describe("cancelTask", () => {
    it("cancels a WORKING task", () => {
      const r = manager.handleSendMessage(makeRequest("Cancel me"));
      const taskId = r.task!.id;

      manager.markWorking(taskId);
      const result = manager.cancelTask(taskId);

      expect(result).toBe(true);
      expect(manager.getTask(taskId)!.status.state).toBe(TaskState.CANCELED);
    });

    it("returns false for nonexistent tasks", () => {
      expect(manager.cancelTask("nonexistent")).toBe(false);
    });

    it("returns false for already-terminal tasks", () => {
      const r = manager.handleSendMessage(makeRequest("Done"));
      const taskId = r.task!.id;

      manager.markWorking(taskId);
      manager.markCompleted(taskId);

      expect(manager.cancelTask(taskId)).toBe(false);
    });
  });

  describe("artifacts", () => {
    it("adds artifacts to a task", () => {
      const r = manager.handleSendMessage(makeRequest("Generate"));
      const taskId = r.task!.id;

      manager.addArtifact(taskId, {
        artifactId: "art_1",
        name: "result.txt",
        parts: [{ text: "Hello world" }],
      });

      expect(manager.getTask(taskId)!.artifacts).toHaveLength(1);
    });

    it("appends to existing artifact", () => {
      const r = manager.handleSendMessage(makeRequest("Stream"));
      const taskId = r.task!.id;

      manager.addArtifact(
        taskId,
        { artifactId: "art_2", parts: [{ text: "chunk1" }] },
        false,
      );

      manager.addArtifact(
        taskId,
        { artifactId: "art_2", parts: [{ text: "chunk2" }] },
        true,
      );

      const task = manager.getTask(taskId)!;
      expect(task.artifacts).toHaveLength(1);
      expect(task.artifacts![0].parts).toHaveLength(2);
    });

    it("emits artifactUpdate event", () => {
      const r = manager.handleSendMessage(makeRequest("Artifact"));
      const taskId = r.task!.id;
      events = [];

      manager.addArtifact(taskId, {
        artifactId: "art_3",
        parts: [{ text: "content" }],
      });

      const artifactEvents = events.filter((e) => e.type === "artifactUpdate");
      expect(artifactEvents).toHaveLength(1);
    });
  });

  describe("AG-UI events", () => {
    it("emits RUN_STARTED / RUN_FINISHED lifecycle", () => {
      const r = manager.handleSendMessage(makeRequest("Run"));
      const taskId = r.task!.id;
      events = [];

      manager.emitRunStarted(taskId);
      manager.emitRunFinished(taskId);

      const aguiEvents = events.filter((e) => e.type === "aguiEvent");
      expect(aguiEvents).toHaveLength(2);
      expect((aguiEvents[0].payload as any).type).toBe("RUN_STARTED");
      expect((aguiEvents[1].payload as any).type).toBe("RUN_FINISHED");
    });

    it("emits text message streaming events", () => {
      const r = manager.handleSendMessage(makeRequest("Stream text"));
      const taskId = r.task!.id;
      events = [];

      manager.emitTextMessageStart(taskId, "msg_1");
      manager.emitTextMessageContent(taskId, "msg_1", "Hello ");
      manager.emitTextMessageContent(taskId, "msg_1", "world");
      manager.emitTextMessageEnd(taskId, "msg_1");

      const aguiEvents = events.filter((e) => e.type === "aguiEvent");
      expect(aguiEvents).toHaveLength(4);
      expect((aguiEvents[0].payload as any).type).toBe("TEXT_MESSAGE_START");
      expect((aguiEvents[1].payload as any).delta).toBe("Hello ");
      expect((aguiEvents[2].payload as any).delta).toBe("world");
      expect((aguiEvents[3].payload as any).type).toBe("TEXT_MESSAGE_END");
    });

    it("emits tool call events", () => {
      const r = manager.handleSendMessage(makeRequest("Use tools"));
      const taskId = r.task!.id;
      events = [];

      manager.emitToolCallStart(taskId, "tc_1", "web_search");
      manager.emitToolCallEnd(taskId, "tc_1");

      const aguiEvents = events.filter((e) => e.type === "aguiEvent");
      expect(aguiEvents).toHaveLength(2);
      expect((aguiEvents[0].payload as any).toolCallName).toBe("web_search");
    });

    it("emits state snapshot", () => {
      const r = manager.handleSendMessage(makeRequest("State"));
      const taskId = r.task!.id;
      events = [];

      manager.emitStateSnapshot(taskId, {
        currentDate: "2026-06-22",
        agentName: "ShadowClaw",
      });

      const aguiEvents = events.filter((e) => e.type === "aguiEvent");
      expect(aguiEvents).toHaveLength(1);
      expect((aguiEvents[0].payload as any).snapshot.currentDate).toBe(
        "2026-06-22",
      );
    });

    it("emits RUN_ERROR on failure", () => {
      const r = manager.handleSendMessage(makeRequest("Error"));
      const taskId = r.task!.id;
      events = [];

      manager.emitRunError(taskId, "API timeout", "TIMEOUT");

      const aguiEvents = events.filter((e) => e.type === "aguiEvent");
      expect(aguiEvents).toHaveLength(1);
      expect((aguiEvents[0].payload as any).message).toBe("API timeout");
      expect((aguiEvents[0].payload as any).code).toBe("TIMEOUT");
    });
  });

  describe("query methods", () => {
    it("getAllTasks returns all tasks", () => {
      manager.handleSendMessage(makeRequest("One"));
      manager.handleSendMessage(makeRequest("Two"));

      expect(manager.getAllTasks()).toHaveLength(2);
    });

    it("getActiveTasks excludes terminal tasks", () => {
      const r1 = manager.handleSendMessage(makeRequest("Active"));
      const r2 = manager.handleSendMessage(makeRequest("Done"));

      manager.markWorking(r2.task!.id);
      manager.markCompleted(r2.task!.id);

      const active = manager.getActiveTasks();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(r1.task!.id);
    });

    it("getActiveTaskForContext returns the active task", () => {
      const msg = makeMessage("Hello", { contextId: "ctx_query" });
      const r = manager.handleSendMessage({ message: msg });

      expect(manager.getActiveTaskForContext("ctx_query")?.id).toBe(r.task!.id);
    });

    it("getActiveTaskForContext returns undefined after completion", () => {
      const msg = makeMessage("Hello", { contextId: "ctx_done" });
      const r = manager.handleSendMessage({ message: msg });

      manager.markWorking(r.task!.id);
      manager.markCompleted(r.task!.id);

      expect(manager.getActiveTaskForContext("ctx_done")).toBeUndefined();
    });
  });

  describe("LRU eviction", () => {
    it("evicts oldest terminal tasks when maxTasks is exceeded", () => {
      const smallManager = new PeerTaskManager({
        maxTasks: 3,
        maxHistoryPerTask: 5,
      });
      smallManager.on(listener);

      // Create and complete 3 tasks
      for (let i = 0; i < 3; i++) {
        const r = smallManager.handleSendMessage(makeRequest(`Task ${i}`));
        smallManager.markWorking(r.task!.id);
        smallManager.markCompleted(r.task!.id);
      }

      expect(smallManager.getAllTasks()).toHaveLength(3);

      // Create a 4th task — should evict the oldest completed one
      smallManager.handleSendMessage(makeRequest("Task 3"));
      expect(smallManager.getAllTasks()).toHaveLength(3);
    });
  });
});
