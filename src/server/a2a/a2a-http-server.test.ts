import { describe, it, expect, beforeEach } from "@jest/globals";
import { A2AHttpServer } from "./a2a-http-server.js";
import { A2ATaskStore } from "./a2a-task-store.js";
import { buildHttpAgentCard } from "./agent-card-builder.js";
import {
  A2A_METHOD,
  A2A_ERROR_CODE,
  Role,
  TaskState,
  type A2AJsonRpcRequest,
} from "../../subsystems/channels/peer-protocol.js";

describe("A2AHttpServer", () => {
  let taskStore: A2ATaskStore;
  let httpServer: A2AHttpServer;
  const agentCard = buildHttpAgentCard({
    baseUrl: "http://127.0.0.1:4000",
    name: "ShadowClaw Node A",
  });

  beforeEach(() => {
    taskStore = new A2ATaskStore();
    httpServer = new A2AHttpServer({
      agentCard,
      taskStore,
    });
  });

  it("handles GetAgentCard request", async () => {
    const request: A2AJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "req-1",
      method: A2A_METHOD.GET_AGENT_CARD,
    };

    const response = await httpServer.handleRequest(request);
    expect(response.id).toBe("req-1");
    expect(response.jsonrpc).toBe("2.0");
    expect(response.error).toBeUndefined();
    expect((response.result as any).name).toBe("ShadowClaw Node A");
  });

  it("handles SendMessage and creates task with working and completed progression", async () => {
    const request: A2AJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "req-2",
      method: A2A_METHOD.SEND_MESSAGE,
      params: {
        message: {
          messageId: "msg-user-1",
          role: Role.USER,
          parts: [{ text: "Hello server B" }],
        },
      },
    };

    const response = await httpServer.handleRequest(request);
    expect(response.id).toBe("req-2");
    expect(response.error).toBeUndefined();

    const result = response.result as any;
    expect(result.task).toBeDefined();
    expect(result.task.id).toBeDefined();
    expect(result.task.status.state).toBe(TaskState.COMPLETED);
    expect(result.task.history.length).toBeGreaterThanOrEqual(2);
    expect(result.task.history[1].role).toBe(Role.AGENT);
  });

  it("handles GetTask for existing and non-existing tasks", async () => {
    const task = taskStore.createTask({
      message: {
        messageId: "m1",
        role: Role.USER,
        parts: [{ text: "Inspect" }],
      },
    });

    const successReq: A2AJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "req-get-1",
      method: A2A_METHOD.GET_TASK,
      params: { taskId: task.id },
    };
    const successRes = await httpServer.handleRequest(successReq);
    expect(successRes.error).toBeUndefined();
    expect((successRes.result as any).id).toBe(task.id);

    const failReq: A2AJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "req-get-2",
      method: A2A_METHOD.GET_TASK,
      params: { taskId: "missing-task-id" },
    };
    const failRes = await httpServer.handleRequest(failReq);
    expect(failRes.error).toBeDefined();
    expect(failRes.error?.code).toBe(A2A_ERROR_CODE.TASK_NOT_FOUND);
  });

  it("handles CancelTask for active and non-cancelable tasks", async () => {
    const task1 = taskStore.createTask({
      message: {
        messageId: "m1",
        role: Role.USER,
        parts: [{ text: "Active" }],
      },
    });

    const cancelReq: A2AJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "req-cancel-1",
      method: A2A_METHOD.CANCEL_TASK,
      params: { taskId: task1.id },
    };
    const cancelRes = await httpServer.handleRequest(cancelReq);
    expect(cancelRes.error).toBeUndefined();
    expect((cancelRes.result as any).status.state).toBe(TaskState.CANCELED);

    // Cancel again (already terminal)
    const cancelAgainReq: A2AJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "req-cancel-2",
      method: A2A_METHOD.CANCEL_TASK,
      params: { taskId: task1.id },
    };
    const cancelAgainRes = await httpServer.handleRequest(cancelAgainReq);
    expect(cancelAgainRes.error).toBeDefined();
    expect(cancelAgainRes.error?.code).toBe(A2A_ERROR_CODE.TASK_NOT_CANCELABLE);
  });

  it("handles ListTasks with filter and pagination", async () => {
    taskStore.createTask({
      message: { messageId: "1", role: Role.USER, parts: [{ text: "1" }] },
    });
    taskStore.createTask({
      message: { messageId: "2", role: Role.USER, parts: [{ text: "2" }] },
    });

    const req: A2AJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "req-list",
      method: "ListTasks",
      params: { limit: 1 },
    };

    const res = await httpServer.handleRequest(req);
    expect(res.error).toBeUndefined();
    const result = res.result as any;
    expect(result.tasks).toHaveLength(1);
    expect(result.nextCursor).toBeDefined();
  });

  it("returns METHOD_NOT_FOUND for unknown methods", async () => {
    const req: A2AJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "req-unknown",
      method: "UnknownMethodName",
    };

    const res = await httpServer.handleRequest(req);
    expect(res.error).toBeDefined();
    expect(res.error?.code).toBe(A2A_ERROR_CODE.METHOD_NOT_FOUND);
  });

  it("returns INVALID_REQUEST for malformed JSON-RPC", async () => {
    const res = await httpServer.handleRequest({
      jsonrpc: "1.0" as any,
      id: "req-bad",
      method: "GetAgentCard",
    });
    expect(res.error).toBeDefined();
    expect(res.error?.code).toBe(A2A_ERROR_CODE.INVALID_REQUEST);
  });

  // JSON-RPC 2.0 spec §4: id may be a String, Number, or NULL
  it("accepts requests with numeric id (JSON-RPC 2.0 spec §4)", async () => {
    const res = await httpServer.handleRequest({
      jsonrpc: "2.0",
      id: 1,
      method: A2A_METHOD.GET_AGENT_CARD,
    });
    expect(res.error).toBeUndefined();
    expect(res.id).toBe(1);
    expect((res.result as any).name).toBe("ShadowClaw Node A");
  });

  it("accepts requests with null id (JSON-RPC 2.0 spec §4)", async () => {
    const res = await httpServer.handleRequest({
      jsonrpc: "2.0",
      id: null,
      method: A2A_METHOD.GET_AGENT_CARD,
    });
    expect(res.error).toBeUndefined();
    expect(res.id).toBeNull();
  });
});
