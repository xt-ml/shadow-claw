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
https://xt-ml.github.io/shadow-claw/bindings/webrtc-datachannel/v1
```

## Architecture

The peer-to-peer channel is structured as three interconnected modules working over a WebRTC DataChannel:

### Protocol Layer (`src/subsystems/channels/peer-protocol.ts`)

Defines the A2A v1.0 canonical data model and AG-UI event types adapted for WebRTC DataChannel transport. Contains:

- **Task States**: SUBMITTED, WORKING, COMPLETED, FAILED, CANCELED, INPUT_REQUIRED, REJECTED (spec §4.1.3)
- **Message Types**: Role (AGENT / USER), Parts (text, raw, URL, data), task references
- **Artifact Types**: Named binary or structured data chunks with streaming semantics
- **AG-UI Events**: RUN_STARTED, RUN_FINISHED, TEXT_MESSAGE_CONTENT, TOOL_CALL_START/END, STATE_SNAPSHOT, STATE_DELTA
- **Wire Envelope**: JSON-RPC 2.0 over DataChannel for SendMessage, GetTask, CancelTask, GetAgentCard methods

### Agent Card Exchange (`src/subsystems/channels/peer-agent-card.ts`)

Constructs and exchanges agent identity and capability information on connection:

- **AgentCard Schema**: name, description, version, supported interfaces, capabilities (streaming, push), skills list, icon
- **Interface Advertisement**: WebRTC protocol binding URL, protocol version
- **Capability Discovery**: Remote peer learns what tools, models, and interaction modes are available before sending first message
- **Exchange Flow**: Both peers send `GetAgentCard` immediately after DataChannel opens; each responds with their capabilities

### Task Manager (`src/subsystems/channels/peer-task-manager.ts`)

Per-connection state machine that:

- **Creates tasks** from incoming `SendMessage` calls without a pre-existing taskId
- **Transitions state** following A2A lifecycle: SUBMITTED → WORKING → terminal state (COMPLETED, FAILED, CANCELED)
- **Emits AG-UI events** during execution (text chunks, tool use, state deltas) for streaming visibility to the caller
- **Stores history**: Recent messages per task for context on follow-up calls
- **Handles cancellation**: `CancelTask` requests transition to CANCELED state and interrupt processing

### PeerJS Integration (`src/subsystems/channels/peerjs.ts`)

The existing channel is augmented to:

- Exchange agent cards via `GetAgentCard` on connection open
- Wrap outgoing `send()` calls in proper A2A Message format (role, parts, contextId/taskId)
- Route incoming messages through the task manager instead of directly to handlers
- Emit AG-UI events from task manager to the UI for streaming rendering
- Emit `TaskStatusUpdateEvent` when tasks reach terminal states
- Accept both legacy `{ type: "chat" }` messages (backward compat) and new A2A JSON-RPC envelopes

### Message Schema Extensions

`InboundMessage` gains optional `taskId` and `contextId` fields to correlate received messages with their originating tasks, enabling proper history tracking across multiple turns in the same conversation.

---

## Protocol Specification

### Data Model

The channel uses A2A v1.0 canonical types adapted for WebRTC DataChannel:

**Task States** (spec §4.1.3):

- `SUBMITTED`: Task created, awaiting processing
- `WORKING`: Active execution
- `COMPLETED`: Success terminal state
- `FAILED`: Error terminal state
- `CANCELED`: Cancellation terminal state
- `INPUT_REQUIRED`: Paused, waiting for user input
- `REJECTED`: Rejected at submission time

**Core Types**:

```typescript
// A2A Roles (spec §4.1.5)
enum Role {
  USER = "ROLE_USER",
  AGENT = "ROLE_AGENT",
}

// A2A Part — multimodal content (spec §4.1.6)
// v1.0 uses member-name discriminator, not "kind"
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
  contextId?: string; // conversation context
  taskId?: string; // originating task
  metadata?: Record<string, unknown>;
  referenceTaskIds?: string[]; // prior tasks this message references
}

// A2A TaskStatus (spec §4.1.2)
interface TaskStatus {
  state: TaskState;
  message?: Message; // most recent message in this state
  timestamp?: string; // ISO 8601
}

// A2A Task (spec §4.1.1) — tracks full lifecycle
interface Task {
  id: string;
  contextId?: string;
  status: TaskStatus;
  artifacts?: Artifact[];
  history?: Message[]; // recent messages in this task
  metadata?: Record<string, unknown>;
}

// A2A Artifact (spec §4.1.7) — named data chunks
interface Artifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: Part[];
  metadata?: Record<string, unknown>;
}
```

### Wire Envelope (JSON-RPC 2.0)

All peer-to-peer messages use JSON-RPC 2.0 framing over the DataChannel (spec §9):

```typescript
interface A2AWireMessage {
  jsonrpc: "2.0";
  id?: string; // present for requests, absent for notifications
  method: string;
  params?: unknown;
  result?: unknown; // present in responses
  error?: A2AError; // present in error responses
}

// Supported methods:
// - "SendMessage"           → initiate or continue a task
// - "GetTask"               → poll task state
// - "CancelTask"            → request task cancellation
// - "GetAgentCard"          → peer capability discovery (called on connect)
// - "agui/event"            → notification of streaming event (no id)
```

### Connection Lifecycle

When a DataChannel opens between peers:

```
1. Capability Exchange
   ← { method: "GetAgentCard", id: "..." }
   → { result: AgentCard }
   → { method: "GetAgentCard", id: "..." }
   ← { result: AgentCard }

2. User Initiates Task
   → { method: "SendMessage", params: {
        message: { role: "ROLE_USER", parts: [...] }
      }}
   ← { result: { task: { id: "...", status: {...} } } }

3. Agent Streams Response
   ← { method: "agui/event", params: {
        type: "TEXT_MESSAGE_START", messageId: "..." } }
   ← { method: "agui/event", params: {
        type: "TEXT_MESSAGE_CONTENT", messageId: "...", delta: "..." } }
   ← { method: "agui/event", params: {
        type: "TEXT_MESSAGE_END", messageId: "..." } }

4. Task Terminal State
   ← { method: "agui/event", params: {
        type: "RUN_FINISHED", runId: "..." } }
   ← { result: { task: { id: "...", status: {
        state: "TASK_STATE_COMPLETED" } } } }
```

### AG-UI Event Stream

AG-UI events are notifications (no request id) sent during task execution to provide streaming visibility to the caller:

```typescript
// Lifecycle
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

// Text streaming
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

// Tool use visibility
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

// State synchronization
interface AGUIStateSnapshot {
  type: "STATE_SNAPSHOT";
  snapshot: Record<string, unknown>;
}

interface AGUIStateDelta {
  type: "STATE_DELTA";
  delta: Array<{ op: string; path: string; value?: unknown }>;
}
```

### Agent Card Exchange

Each peer advertises its identity and capabilities via `AgentCard`:

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
  pushNotifications: boolean; // false for WebRTC (we use DataChannel)
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

The card is constructed from the local agent's configuration (model, available tools, name) and sent immediately when the DataChannel opens, allowing the remote peer to make informed decisions about what to ask the agent.

### Task State Machine

The TaskManager (`peer-task-manager.ts`) maintains per-connection state:

- **Creates tasks** from incoming `SendMessage` calls without a pre-existing `taskId`
- **Transitions state** following A2A lifecycle:
  ```
  SUBMITTED → WORKING → COMPLETED (terminal)
                      → FAILED (terminal)
                      → CANCELED (terminal)
                      → INPUT_REQUIRED (interrupted) → WORKING
  ```
- **Emits AG-UI events** on each state transition and during message streaming
- **Maintains history**: Stores recent messages per task for context on follow-up calls
- **Handles cancellation**: `CancelTask` requests move the task to CANCELED state and interrupt in-flight processing

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
