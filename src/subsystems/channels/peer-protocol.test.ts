import {
  TaskState,
  Role,
  TERMINAL_STATES,
  INTERRUPTED_STATES,
  A2A_PROTOCOL_BINDING,
  A2A_PROTOCOL_VERSION,
  A2A_METHOD,
  AGUI_METHOD,
  A2A_STREAM_METHOD,
  A2A_ERROR_CODE,
  isJsonRpcRequest,
  isJsonRpcResponse,
  type A2AJsonRpcRequest,
  type A2AJsonRpcResponse,
  type A2AJsonRpcNotification,
  type TextPart,
  type RawPart,
  type UrlPart,
  type DataPart,
  type A2AMessage,
  type A2ATask,
  type Artifact,
  type TaskStatusUpdateEvent,
  type TaskArtifactUpdateEvent,
  type AGUIRunStarted,
  type AGUITextMessageContent,
  type AGUIToolCallStart,
  type AGUIStateSnapshot,
} from "./peer-protocol.js";

describe("peer-protocol types and guards", () => {
  describe("constants", () => {
    it("exports protocol binding identifier", () => {
      expect(A2A_PROTOCOL_BINDING).toBe(
        "https://xt-ml.github.io/shadow-claw/bindings/webrtc-datachannel/v1",
      );
    });

    it("exports protocol version", () => {
      expect(A2A_PROTOCOL_VERSION).toBe("1.0");
    });

    it("exports A2A method constants", () => {
      expect(A2A_METHOD.SEND_MESSAGE).toBe("SendMessage");
      expect(A2A_METHOD.GET_AGENT_CARD).toBe("GetAgentCard");
      expect(A2A_METHOD.CANCEL_TASK).toBe("CancelTask");
      expect(A2A_METHOD.GET_TASK).toBe("GetTask");
    });

    it("exports AG-UI method", () => {
      expect(AGUI_METHOD.EVENT).toBe("agui/event");
    });

    it("exports streaming methods", () => {
      expect(A2A_STREAM_METHOD.STATUS_UPDATE).toBe("tasks/statusUpdate");
      expect(A2A_STREAM_METHOD.ARTIFACT_UPDATE).toBe("tasks/artifactUpdate");
    });
  });

  describe("TaskState", () => {
    it("defines all required states", () => {
      expect(TaskState.SUBMITTED).toBe("TASK_STATE_SUBMITTED");
      expect(TaskState.WORKING).toBe("TASK_STATE_WORKING");
      expect(TaskState.COMPLETED).toBe("TASK_STATE_COMPLETED");
      expect(TaskState.FAILED).toBe("TASK_STATE_FAILED");
      expect(TaskState.CANCELED).toBe("TASK_STATE_CANCELED");
      expect(TaskState.INPUT_REQUIRED).toBe("TASK_STATE_INPUT_REQUIRED");
      expect(TaskState.REJECTED).toBe("TASK_STATE_REJECTED");
    });

    it("TERMINAL_STATES contains the correct states", () => {
      expect(TERMINAL_STATES.has(TaskState.COMPLETED)).toBe(true);
      expect(TERMINAL_STATES.has(TaskState.FAILED)).toBe(true);
      expect(TERMINAL_STATES.has(TaskState.CANCELED)).toBe(true);
      expect(TERMINAL_STATES.has(TaskState.REJECTED)).toBe(true);
      expect(TERMINAL_STATES.has(TaskState.WORKING)).toBe(false);
      expect(TERMINAL_STATES.has(TaskState.SUBMITTED)).toBe(false);
    });

    it("INTERRUPTED_STATES contains INPUT_REQUIRED and AUTH_REQUIRED", () => {
      expect(INTERRUPTED_STATES.has(TaskState.INPUT_REQUIRED)).toBe(true);
      expect(INTERRUPTED_STATES.has(TaskState.AUTH_REQUIRED)).toBe(true);
      expect(INTERRUPTED_STATES.has(TaskState.WORKING)).toBe(false);
    });
  });

  describe("Role", () => {
    it("defines user and agent roles", () => {
      expect(Role.USER).toBe("ROLE_USER");
      expect(Role.AGENT).toBe("ROLE_AGENT");
    });
  });

  describe("A2A_ERROR_CODE", () => {
    it("defines standard error codes", () => {
      expect(A2A_ERROR_CODE.TASK_NOT_FOUND).toBe(-32001);
      expect(A2A_ERROR_CODE.TASK_NOT_CANCELABLE).toBe(-32002);
      expect(A2A_ERROR_CODE.METHOD_NOT_FOUND).toBe(-32601);
      expect(A2A_ERROR_CODE.INVALID_PARAMS).toBe(-32602);
      expect(A2A_ERROR_CODE.INTERNAL_ERROR).toBe(-32603);
      expect(A2A_ERROR_CODE.PARSE_ERROR).toBe(-32700);
    });
  });

  describe("isJsonRpcRequest", () => {
    it("returns true for valid requests", () => {
      const req: A2AJsonRpcRequest = {
        jsonrpc: "2.0",
        id: "req_1",
        method: "SendMessage",
        params: {},
      };
      expect(isJsonRpcRequest(req)).toBe(true);
    });

    it("returns false for responses", () => {
      const resp: A2AJsonRpcResponse = {
        jsonrpc: "2.0",
        id: "req_1",
        result: {},
      };
      expect(isJsonRpcRequest(resp)).toBe(false);
    });

    it("returns false for notifications (no id)", () => {
      const notif: A2AJsonRpcNotification = {
        jsonrpc: "2.0",
        method: "agui/event",
        params: {},
      };
      expect(isJsonRpcRequest(notif)).toBe(false);
    });

    it("returns false for null/non-objects", () => {
      expect(isJsonRpcRequest(null)).toBe(false);
      expect(isJsonRpcRequest(undefined)).toBe(false);
      expect(isJsonRpcRequest("string")).toBe(false);
      expect(isJsonRpcRequest(42)).toBe(false);
    });
  });

  describe("isJsonRpcResponse", () => {
    it("returns true for valid responses", () => {
      const resp: A2AJsonRpcResponse = {
        jsonrpc: "2.0",
        id: "req_1",
        result: { task: {} },
      };
      expect(isJsonRpcResponse(resp)).toBe(true);
    });

    it("returns true for error responses", () => {
      const resp: A2AJsonRpcResponse = {
        jsonrpc: "2.0",
        id: "req_1",
        error: { code: -32601, message: "Method not found" },
      };
      expect(isJsonRpcResponse(resp)).toBe(true);
    });

    it("returns false for requests (has method)", () => {
      const req: A2AJsonRpcRequest = {
        jsonrpc: "2.0",
        id: "req_1",
        method: "GetTask",
      };
      expect(isJsonRpcResponse(req)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isJsonRpcResponse(null)).toBe(false);
    });
  });

  describe("type compatibility", () => {
    it("TextPart has text field", () => {
      const part: TextPart = { text: "Hello" };
      expect(part.text).toBe("Hello");
    });

    it("RawPart has raw field (base64)", () => {
      const part: RawPart = { raw: "SGVsbG8=", mediaType: "text/plain" };
      expect(part.raw).toBe("SGVsbG8=");
    });

    it("UrlPart has url field", () => {
      const part: UrlPart = { url: "https://example.com/file.txt" };
      expect(part.url).toBe("https://example.com/file.txt");
    });

    it("DataPart has data field", () => {
      const part: DataPart = { data: { key: "value" } };
      expect(part.data).toEqual({ key: "value" });
    });

    it("A2AMessage conforms to interface", () => {
      const msg: A2AMessage = {
        messageId: "msg_1",
        role: Role.USER,
        parts: [{ text: "Hello" }],
        contextId: "ctx_1",
      };
      expect(msg.messageId).toBe("msg_1");
      expect(msg.role).toBe(Role.USER);
    });

    it("A2ATask conforms to interface", () => {
      const task: A2ATask = {
        id: "task_1",
        contextId: "ctx_1",
        status: {
          state: TaskState.WORKING,
          timestamp: "2026-06-22T00:00:00Z",
        },
        history: [],
      };
      expect(task.status.state).toBe(TaskState.WORKING);
    });

    it("Artifact conforms to interface", () => {
      const artifact: Artifact = {
        artifactId: "art_1",
        name: "output.txt",
        parts: [{ text: "result" }],
      };
      expect(artifact.artifactId).toBe("art_1");
    });

    it("TaskStatusUpdateEvent conforms to interface", () => {
      const event: TaskStatusUpdateEvent = {
        taskId: "task_1",
        contextId: "ctx_1",
        status: { state: TaskState.COMPLETED },
      };
      expect(event.status.state).toBe(TaskState.COMPLETED);
    });

    it("TaskArtifactUpdateEvent conforms to interface", () => {
      const event: TaskArtifactUpdateEvent = {
        taskId: "task_1",
        contextId: "ctx_1",
        artifact: { artifactId: "art_1", parts: [{ text: "data" }] },
        append: false,
        lastChunk: true,
      };
      expect(event.lastChunk).toBe(true);
    });

    it("AGUIRunStarted conforms to interface", () => {
      const event: AGUIRunStarted = {
        type: "RUN_STARTED",
        threadId: "thread_1",
        runId: "run_1",
      };
      expect(event.type).toBe("RUN_STARTED");
    });

    it("AGUITextMessageContent conforms to interface", () => {
      const event: AGUITextMessageContent = {
        type: "TEXT_MESSAGE_CONTENT",
        messageId: "msg_1",
        delta: "Hello ",
      };
      expect(event.delta).toBe("Hello ");
    });

    it("AGUIToolCallStart conforms to interface", () => {
      const event: AGUIToolCallStart = {
        type: "TOOL_CALL_START",
        toolCallId: "tc_1",
        toolCallName: "search",
      };
      expect(event.toolCallName).toBe("search");
    });

    it("AGUIStateSnapshot conforms to interface", () => {
      const event: AGUIStateSnapshot = {
        type: "STATE_SNAPSHOT",
        snapshot: { date: "2026-06-22" },
      };
      expect(event.snapshot.date).toBe("2026-06-22");
    });
  });
});
