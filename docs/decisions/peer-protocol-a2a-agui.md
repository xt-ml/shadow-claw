# ADR: Adopt A2A + AG-UI for Peer-to-Peer Agent Communication

## Status

Accepted — Implementation in progress

## Context

The current PeerJS channel uses an ad-hoc protocol:

- Messages are wrapped in A2A-style JSON-RPC envelopes (`message/send`) but lack the full A2A task lifecycle
- Agent identity relies on local aliases rather than a negotiated canonical exchange
- There is no native task completion or conversation termination mechanism
- No capability discovery, no structured state machine, no streaming visibility

This leads to:

- Repeated sign-off volleys (agents can't agree to stop)
- Hallucinated facts (no shared ground-truth state)
- No tool-use transparency between peers
- No structured error handling or task cancellation

## Decision

Implement a **custom A2A v1.0 protocol binding over WebRTC DataChannel**, augmented with **AG-UI event patterns** for streaming visibility. This follows the A2A spec's Section 12 (Custom Binding Guidelines).

### Protocol Binding Identifier

```
http://localhost:8888/bindings/webrtc-datachannel/v1
```

## Architecture

### New Files

| File                                | Purpose                                                |
| ----------------------------------- | ------------------------------------------------------ |
| `src/channels/peer-protocol.ts`     | A2A data model types, AG-UI events, task state machine |
| `src/channels/peer-agent-card.ts`   | AgentCard construction and exchange logic              |
| `src/channels/peer-task-manager.ts` | Task lifecycle state machine (per-connection)          |

### Modified Files

| File                     | Change                                                                  |
| ------------------------ | ----------------------------------------------------------------------- |
| `src/channels/peerjs.ts` | Use new protocol layer for send/receive, agent card exchange on connect |
| `src/types.ts`           | Add optional `taskId`, `contextId` to `InboundMessage`                  |

---

## Implementation Plan

### Phase 1: Protocol Types (`peer-protocol.ts`)

Define the A2A v1.0 canonical data model adapted for WebRTC:

```typescript
// A2A Task States (spec §4.1.3)
enum TaskState {
  SUBMITTED = "TASK_STATE_SUBMITTED",
  WORKING = "TASK_STATE_WORKING",
  COMPLETED = "TASK_STATE_COMPLETED",
  FAILED = "TASK_STATE_FAILED",
  CANCELED = "TASK_STATE_CANCELED",
  INPUT_REQUIRED = "TASK_STATE_INPUT_REQUIRED",
  REJECTED = "TASK_STATE_REJECTED",
}

// A2A Roles (spec §4.1.5)
enum Role {
  USER = "ROLE_USER",
  AGENT = "ROLE_AGENT",
}

// A2A Part (spec §4.1.6 — v1.0 uses member-name discriminator, not "kind")
type Part =
  | { text: string; mediaType?: string; metadata?: Record<string, unknown> }
  | {
      raw: string;
      filename?: string;
      mediaType?: string;
      metadata?: Record<string, unknown>;
    }
  | {
      url: string;
      filename?: string;
      mediaType?: string;
      metadata?: Record<string, unknown>;
    }
  | { data: unknown; mediaType?: string; metadata?: Record<string, unknown> };

// A2A Message (spec §4.1.4)
interface Message {
  messageId: string;
  role: Role;
  parts: Part[];
  contextId?: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
  referenceTaskIds?: string[];
}

// A2A TaskStatus (spec §4.1.2)
interface TaskStatus {
  state: TaskState;
  message?: Message;
  timestamp?: string; // ISO 8601
}

// A2A Task (spec §4.1.1)
interface Task {
  id: string;
  contextId?: string;
  status: TaskStatus;
  artifacts?: Artifact[];
  history?: Message[];
  metadata?: Record<string, unknown>;
}

// A2A Artifact (spec §4.1.7)
interface Artifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: Part[];
  metadata?: Record<string, unknown>;
}

// Streaming events (spec §4.2)
interface TaskStatusUpdateEvent {
  taskId: string;
  contextId: string;
  status: TaskStatus;
  metadata?: Record<string, unknown>;
}

interface TaskArtifactUpdateEvent {
  taskId: string;
  contextId: string;
  artifact: Artifact;
  append?: boolean;
  lastChunk?: boolean;
  metadata?: Record<string, unknown>;
}
```

#### AG-UI Events (layered on top for streaming visibility)

```typescript
// AG-UI lifecycle events
interface AGUIRunStarted {
  type: "RUN_STARTED";
  threadId: string;
  runId: string;
}

interface AGUIRunFinished {
  type: "RUN_FINISHED";
  threadId: string;
  runId: string;
}

// AG-UI text streaming
interface AGUITextMessageStart {
  type: "TEXT_MESSAGE_START";
  messageId: string;
  role: "assistant" | "user";
}

interface AGUITextMessageContent {
  type: "TEXT_MESSAGE_CONTENT";
  messageId: string;
  delta: string;
}

interface AGUITextMessageEnd {
  type: "TEXT_MESSAGE_END";
  messageId: string;
}

// AG-UI tool call visibility
interface AGUIToolCallStart {
  type: "TOOL_CALL_START";
  toolCallId: string;
  toolCallName: string;
  parentMessageId?: string;
}

interface AGUIToolCallEnd {
  type: "TOOL_CALL_END";
  toolCallId: string;
}

// AG-UI state sync
interface AGUIStateSnapshot {
  type: "STATE_SNAPSHOT";
  snapshot: Record<string, unknown>;
}

interface AGUIStateDelta {
  type: "STATE_DELTA";
  delta: Array<{ op: string; path: string; value?: unknown }>;
}
```

### Phase 2: Wire Protocol (JSON-RPC over DataChannel)

Following A2A JSON-RPC binding (spec §9), adapted for bidirectional DataChannel:

```typescript
// All messages over the DataChannel use this envelope
interface A2AWireMessage {
  jsonrpc: "2.0";
  id?: string; // present for requests, absent for notifications
  method: string;
  params?: unknown;
  result?: unknown; // present in responses
  error?: A2AError; // present in error responses
}

// Methods we support over WebRTC DataChannel:
// - "SendMessage"           → initiate/continue task
// - "SendStreamingMessage"  → streaming with AG-UI events
// - "GetTask"               → poll task state
// - "CancelTask"            → request cancellation
// - "GetAgentCard"          → capability discovery (custom, on-connect)
//
// AG-UI events are sent as notifications (no id):
// - "agui/event"            → AG-UI event notification
```

#### Connection Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│ WebRTC DataChannel Connection Opened                    │
├─────────────────────────────────────────────────────────┤
│ 1. Both peers exchange AgentCards:                      │
│    → { method: "GetAgentCard", id: "..." }              │
│    ← { result: { ...AgentCard } }                       │
│                                                         │
│ 2. Client sends message to initiate task:               │
│    → { method: "SendMessage", params: {                 │
│         message: { role: "ROLE_USER", parts: [...] }    │
│       }}                                                │
│    ← { result: { task: { id: "...", status: {           │
│         state: "TASK_STATE_WORKING" } } } }             │
│                                                         │
│ 3. Agent streams AG-UI events:                          │
│    ← { method: "agui/event", params: {                  │
│         type: "TEXT_MESSAGE_START", ... } }             │
│    ← { method: "agui/event", params: {                  │
│         type: "TEXT_MESSAGE_CONTENT", delta: "..." } }  │
│    ← { method: "agui/event", params: {                  │
│         type: "TEXT_MESSAGE_END", ... } }               │
│                                                         │
│ 4. Task completes:                                      │
│    ← { method: "agui/event", params: {                  │
│         type: "RUN_FINISHED", ... } }                   │
│    ← { method: "tasks/statusUpdate", params: {          │
│         taskId: "...", status: {                        │
│           state: "TASK_STATE_COMPLETED" } } }           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Phase 3: Agent Card (`peer-agent-card.ts`)

```typescript
interface AgentCard {
  name: string;
  description: string;
  version: string;
  supportedInterfaces: AgentInterface[];
  capabilities: AgentCapabilities;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: AgentSkill[];
  iconUrl?: string;
}

interface AgentInterface {
  url: string; // e.g., "webrtc://<peer-id>"
  protocolBinding: "http://localhost:8888/bindings/webrtc-datachannel/v1";
  protocolVersion: "1.0";
}

interface AgentCapabilities {
  streaming: boolean;
  pushNotifications: boolean; // false for WebRTC (we have DataChannel)
  extensions?: AgentExtension[];
}

interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}
```

The agent card is constructed from the local agent's configuration (model, tools, name) and exchanged immediately when a DataChannel opens.

### Phase 4: Task Manager (`peer-task-manager.ts`)

A per-connection state machine that:

1. **Creates tasks** when `SendMessage` is received without a `taskId`
2. **Transitions states** following the A2A state diagram:
   ```
   SUBMITTED → WORKING → COMPLETED (terminal)
                       → FAILED (terminal)
                       → CANCELED (terminal)
                       → INPUT_REQUIRED (interrupted) → WORKING
   ```
3. **Emits AG-UI events** during task execution for streaming visibility
4. **Stores task history** (recent messages per task)
5. **Handles CancelTask** requests gracefully

### Phase 5: Integration into `peerjs.ts`

Modify the existing channel to:

1. **On connection open**: Exchange agent cards via `GetAgentCard`
2. **On send()**: Wrap in `SendMessage` with proper A2A Message format
3. **On receive**: Dispatch through task manager, emit AG-UI events to UI
4. **On task complete**: Emit `TaskStatusUpdateEvent` with terminal state
5. **Backward compat**: Continue accepting legacy `{ type: "chat" }` messages

### Phase 6: AG-UI Event Rendering

The UI already handles streaming text. AG-UI events add:

- **Tool call indicators**: Show when peer agent is using tools
- **State sync**: Shared facts (current date, session metadata)
- **Run lifecycle**: Clear start/end boundaries in the UI

---

## Backward Compatibility

- Legacy `{ type: "chat", text }` messages continue to be accepted
- Legacy `{ jsonrpc: "2.0", method: "message/send" }` (current format) accepted
- New protocol is opt-in: if peer doesn't respond to `GetAgentCard`, fall back to legacy mode
- The `kind` field in parts is preserved for backward compat during transition (A2A v0.3 → v1.0 migration path)

## What This Eliminates

| Before                          | After                                 |
| ------------------------------- | ------------------------------------- |
| Un-negotiated identity          | Agent identity from AgentCard `.name` |
| Unbounded conversation triggers | `TASK_STATE_COMPLETED` status update  |
| Divergent tool visibility       | `TOOL_CALL_START/END` AG-UI events    |
| Repeated sign-off volleys       | Single terminal state transition      |
| No error handling               | `TASK_STATE_FAILED` + JSON-RPC errors |
| No cancellation                 | `CancelTask` method                   |

## References

- [A2A Protocol Specification v1.0](https://a2a-protocol.org/latest/specification/)
- [AG-UI Protocol Events](https://docs.ag-ui.com/concepts/events)
- [A2A Custom Binding Guidelines (§12)](https://a2a-protocol.org/latest/specification/#12-custom-binding-guidelines)
- [AG-UI GitHub](https://github.com/ag-ui-protocol/ag-ui)
