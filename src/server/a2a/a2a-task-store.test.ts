import { describe, it, expect, jest } from "@jest/globals";
import { A2ATaskStore } from "./a2a-task-store.js";
import { TaskState, Role } from "../../subsystems/channels/peer-protocol.js";

describe("A2ATaskStore", () => {
  it("creates a task in TASK_STATE_SUBMITTED and generates ID and contextId", () => {
    const store = new A2ATaskStore();
    const task = store.createTask({
      message: {
        messageId: "msg-1",
        role: Role.USER,
        parts: [{ text: "Summarize this data" }],
      },
    });

    expect(task.id).toBeDefined();
    expect(task.contextId).toBeDefined();
    expect(task.status.state).toBe(TaskState.SUBMITTED);
    expect(task.status.timestamp).toBeDefined();
    expect(task.history).toHaveLength(1);
    expect(task.history![0].messageId).toBe("msg-1");
  });

  it("preserves provided contextId on task creation", () => {
    const store = new A2ATaskStore();
    const task = store.createTask({
      message: {
        messageId: "msg-2",
        role: Role.USER,
        parts: [{ text: "Follow up" }],
        contextId: "ctx-custom-99",
      },
    });

    expect(task.contextId).toBe("ctx-custom-99");
  });

  it("retrieves an existing task or returns undefined for non-existent", () => {
    const store = new A2ATaskStore();
    const task = store.createTask({
      message: {
        messageId: "msg-1",
        role: Role.USER,
        parts: [{ text: "Hello" }],
      },
    });

    expect(store.getTask(task.id)).toEqual(task);
    expect(store.getTask("non-existent-id")).toBeUndefined();
  });

  it("does not expose mutable task state through snapshots", () => {
    const store = new A2ATaskStore();
    const task = store.createTask({
      message: {
        messageId: "msg-1",
        role: Role.USER,
        parts: [{ text: "Keep this intact" }],
      },
    });

    const snapshot = store.getTask(task.id)!;
    snapshot.status.state = TaskState.COMPLETED;
    snapshot.history![0].parts[0] = { text: "Mutated" };

    const current = store.getTask(task.id)!;
    expect(current.status.state).toBe(TaskState.SUBMITTED);
    expect(current.history![0].parts[0]).toEqual({
      text: "Keep this intact",
    });
  });

  it("updates task state to WORKING and then COMPLETED, appending response messages", () => {
    const store = new A2ATaskStore();
    const task = store.createTask({
      message: {
        messageId: "msg-1",
        role: Role.USER,
        parts: [{ text: "Compute" }],
      },
    });

    const working = store.updateTaskStatus(task.id, TaskState.WORKING);
    expect(working?.status.state).toBe(TaskState.WORKING);

    const agentMsg = {
      messageId: "msg-agent-1",
      role: Role.AGENT,
      parts: [{ text: "Result is 42" }],
      taskId: task.id,
    };
    const completed = store.updateTaskStatus(
      task.id,
      TaskState.COMPLETED,
      agentMsg,
    );
    expect(completed?.status.state).toBe(TaskState.COMPLETED);
    expect(completed?.history).toHaveLength(2);
    expect(completed?.history![1].messageId).toBe("msg-agent-1");
  });

  it("rejects transitions from terminal states", () => {
    const store = new A2ATaskStore();
    const task = store.createTask({
      message: {
        messageId: "msg-1",
        role: Role.USER,
        parts: [{ text: "Compute" }],
      },
    });

    store.updateTaskStatus(task.id, TaskState.WORKING);
    store.updateTaskStatus(task.id, TaskState.COMPLETED);

    expect(() => {
      store.updateTaskStatus(task.id, TaskState.WORKING);
    }).toThrow(/terminal state/i);
  });

  it("cancels an active task and rejects cancellation of completed tasks", () => {
    const store = new A2ATaskStore();
    const task1 = store.createTask({
      message: {
        messageId: "msg-1",
        role: Role.USER,
        parts: [{ text: "Task 1" }],
      },
    });

    const canceled = store.cancelTask(task1.id);
    expect(canceled.status.state).toBe(TaskState.CANCELED);

    const task2 = store.createTask({
      message: {
        messageId: "msg-2",
        role: Role.USER,
        parts: [{ text: "Task 2" }],
      },
    });
    store.updateTaskStatus(task2.id, TaskState.COMPLETED);

    expect(() => {
      store.cancelTask(task2.id);
    }).toThrow(/not cancelable/i);
  });

  it("adds artifacts to a task", () => {
    const store = new A2ATaskStore();
    const task = store.createTask({
      message: {
        messageId: "msg-1",
        role: Role.USER,
        parts: [{ text: "Generate chart" }],
      },
    });

    const updated = store.addArtifact(task.id, {
      artifactId: "art-1",
      name: "report.json",
      parts: [{ data: { result: "ok" } }],
    });

    expect(updated?.artifacts).toHaveLength(1);
    expect(updated?.artifacts![0].artifactId).toBe("art-1");
  });

  it("emits events to subscribers when task status or artifacts update", () => {
    const store = new A2ATaskStore();
    const task = store.createTask({
      message: {
        messageId: "msg-1",
        role: Role.USER,
        parts: [{ text: "Subscribe test" }],
      },
    });

    const listener = jest.fn();
    const unsubscribe = store.subscribe(task.id, listener);

    store.updateTaskStatus(task.id, TaskState.WORKING);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "statusUpdate",
        taskId: task.id,
        payload: expect.objectContaining({
          taskId: task.id,
          status: expect.objectContaining({ state: TaskState.WORKING }),
        }),
      }),
    );

    store.addArtifact(task.id, {
      artifactId: "art-1",
      parts: [{ text: "file content" }],
    });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "artifactUpdate",
        taskId: task.id,
      }),
    );

    unsubscribe();
    store.updateTaskStatus(task.id, TaskState.COMPLETED);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("paginates and filters tasks with listTasks", () => {
    const store = new A2ATaskStore();
    const t1 = store.createTask({
      message: { messageId: "1", role: Role.USER, parts: [{ text: "1" }] },
    });
    store.createTask({
      message: { messageId: "2", role: Role.USER, parts: [{ text: "2" }] },
    });
    store.createTask({
      message: { messageId: "3", role: Role.USER, parts: [{ text: "3" }] },
    });

    store.updateTaskStatus(t1.id, TaskState.COMPLETED);

    const completed = store.listTasks({ state: TaskState.COMPLETED });
    expect(completed.tasks).toHaveLength(1);
    expect(completed.tasks[0].id).toBe(t1.id);

    const paged = store.listTasks({ limit: 2 });
    expect(paged.tasks).toHaveLength(2);
    expect(paged.nextCursor).toBeDefined();

    const rest = store.listTasks({ limit: 2, cursor: paged.nextCursor });
    expect(rest.tasks).toHaveLength(1);
    expect(rest.nextCursor).toBeUndefined();
  });

  it("evicts oldest tasks when maxTasks is exceeded", () => {
    const store = new A2ATaskStore({ maxTasks: 2 });
    const t1 = store.createTask({
      message: { messageId: "1", role: Role.USER, parts: [{ text: "1" }] },
    });
    const t2 = store.createTask({
      message: { messageId: "2", role: Role.USER, parts: [{ text: "2" }] },
    });
    const t3 = store.createTask({
      message: { messageId: "3", role: Role.USER, parts: [{ text: "3" }] },
    });

    expect(store.getTask(t1.id)).toBeUndefined();
    expect(store.getTask(t2.id)).toBeDefined();
    expect(store.getTask(t3.id)).toBeDefined();
  });
});
