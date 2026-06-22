/**
 * AG-UI Event Adapter
 *
 * Translates orchestrator EventBus events into AG-UI protocol events,
 * dispatched as DOM CustomEvents on `window`. This is entirely independent
 * of PeerJS — it works for any conversation (browser chat, peer, etc.).
 *
 * AG-UI events are emitted on the "shadow-claw-agui-event" CustomEvent with
 * detail: { groupId: string; event: AGUIEvent }.
 *
 * References:
 * - https://docs.ag-ui.com/concepts/events
 * - src/channels/peer-protocol.ts (type definitions)
 */

import type {
  AGUIEvent,
  AGUIRunStarted,
  AGUIRunFinished,
  AGUITextMessageStart,
  AGUITextMessageContent,
  AGUITextMessageEnd,
  AGUIToolCallStart,
  AGUIToolCallEnd,
} from "./channels/peer-protocol.js";

import { ulid } from "./utils/ulid.js";

// =============================================================================
// Types
// =============================================================================

interface EventBus {
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
}

/** Per-group run tracking state */
interface RunState {
  runId: string;
  threadId: string;
  messageId: string | null;
  activeToolCallIds: Set<string>;
}

// =============================================================================
// AG-UI Adapter
// =============================================================================

export class AGUIAdapter {
  private _events: EventBus;
  private _runs = new Map<string, RunState>();
  private _handlers: Array<{ event: string; handler: Function }> = [];

  constructor(events: EventBus) {
    this._events = events;
  }

  /** Start listening to orchestrator events and emitting AG-UI events. */
  start(): void {
    this._listen("streaming-start", this._onStreamingStart);
    this._listen("streaming-chunk", this._onStreamingChunk);
    this._listen("streaming-end", this._onStreamingEnd);
    this._listen("streaming-done", this._onStreamingDone);
    this._listen("streaming-error", this._onStreamingError);
    this._listen("tool-activity", this._onToolActivity);
  }

  /** Stop listening and clean up. */
  stop(): void {
    for (const { event, handler } of this._handlers) {
      this._events.off(event, handler);
    }

    this._handlers = [];
    this._runs.clear();
  }

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  private _onStreamingStart = ({ groupId }: { groupId: string }): void => {
    const runId = ulid();
    const threadId = groupId;
    const messageId = ulid();

    this._runs.set(groupId, {
      runId,
      threadId,
      messageId,
      activeToolCallIds: new Set(),
    });

    // RUN_STARTED
    this._emit(groupId, {
      type: "RUN_STARTED",
      threadId,
      runId,
      timestamp: Date.now(),
    } satisfies AGUIRunStarted);

    // TEXT_MESSAGE_START
    this._emit(groupId, {
      type: "TEXT_MESSAGE_START",
      messageId,
      role: "assistant",
      timestamp: Date.now(),
    } satisfies AGUITextMessageStart);
  };

  private _onStreamingChunk = ({
    groupId,
    text,
  }: {
    groupId: string;
    text: string;
  }): void => {
    const run = this._runs.get(groupId);
    if (!run || !run.messageId) {
      return;
    }

    this._emit(groupId, {
      type: "TEXT_MESSAGE_CONTENT",
      messageId: run.messageId,
      delta: text,
      timestamp: Date.now(),
    } satisfies AGUITextMessageContent);
  };

  private _onStreamingEnd = ({ groupId }: { groupId: string }): void => {
    // streaming-end means text is done but tool calls are about to run
    const run = this._runs.get(groupId);
    if (!run || !run.messageId) {
      return;
    }

    this._emit(groupId, {
      type: "TEXT_MESSAGE_END",
      messageId: run.messageId,
      timestamp: Date.now(),
    } satisfies AGUITextMessageEnd);

    run.messageId = null;
  };

  private _onStreamingDone = ({ groupId }: { groupId: string }): void => {
    // streaming-done means the entire response cycle is finished
    const run = this._runs.get(groupId);
    if (!run) {
      return;
    }

    // Close any open message (non-streaming responses skip streaming-end)
    if (run.messageId) {
      this._emit(groupId, {
        type: "TEXT_MESSAGE_END",
        messageId: run.messageId,
        timestamp: Date.now(),
      } satisfies AGUITextMessageEnd);
    }

    // RUN_FINISHED
    this._emit(groupId, {
      type: "RUN_FINISHED",
      threadId: run.threadId,
      runId: run.runId,
      timestamp: Date.now(),
    } satisfies AGUIRunFinished);

    this._runs.delete(groupId);
  };

  private _onStreamingError = ({
    groupId,
    error,
  }: {
    groupId: string;
    error?: string;
  }): void => {
    const run = this._runs.get(groupId);
    if (!run) {
      return;
    }

    // Close open message if any
    if (run.messageId) {
      this._emit(groupId, {
        type: "TEXT_MESSAGE_END",
        messageId: run.messageId,
        timestamp: Date.now(),
      } satisfies AGUITextMessageEnd);
    }

    this._emit(groupId, {
      type: "RUN_ERROR",
      message: error || "Unknown streaming error",
      timestamp: Date.now(),
    });

    this._runs.delete(groupId);
  };

  private _onToolActivity = ({
    groupId,
    tool,
    status,
  }: {
    groupId: string;
    tool: string;
    status: string;
  }): void => {
    const run = this._runs.get(groupId);
    if (!run) {
      return;
    }

    if (status === "running") {
      const toolCallId = ulid();
      run.activeToolCallIds.add(toolCallId);

      this._emit(groupId, {
        type: "TOOL_CALL_START",
        toolCallId,
        toolCallName: tool,
        timestamp: Date.now(),
      } satisfies AGUIToolCallStart);

      // Store mapping: tool name → toolCallId for end matching
      // Use a simple approach: store on the set (latest wins)
      (run as any)._lastToolCallId = toolCallId;
    } else if (status === "done" || status === "error") {
      const toolCallId = (run as any)._lastToolCallId;
      if (toolCallId) {
        run.activeToolCallIds.delete(toolCallId);

        this._emit(groupId, {
          type: "TOOL_CALL_END",
          toolCallId,
          timestamp: Date.now(),
        } satisfies AGUIToolCallEnd);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private _listen(event: string, handler: Function): void {
    this._events.on(event, handler);
    this._handlers.push({ event, handler });
  }

  private _emit(groupId: string, event: AGUIEvent): void {
    window.dispatchEvent(
      new CustomEvent("shadow-claw-agui-event", {
        detail: { groupId, event },
      }),
    );
  }
}
