/**
 * Client for interacting with remote A2A v1.0 Agent Servers over HTTP JSON-RPC 2.0.
 *
 * Supports:
 * - AgentCard discovery (`GET /.well-known/agent-card.json`)
 * - Task submission (`SendMessage`)
 * - Task inspection (`GetTask`, `ListTasks`)
 * - Task cancellation (`CancelTask`)
 * - Real-time SSE streaming (`GET /a2a/tasks/:taskId`)
 *
 * References:
 * - A2A v1.0 Specification
 * - ADR: docs/decisions/server-a2a-http-binding.md
 */

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

import type {
  AgentCard,
  A2ATask,
  SendMessageRequest,
  SendMessageResponse,
  A2AJsonRpcRequest,
  A2AJsonRpcResponse,
} from "../../subsystems/channels/peer-protocol.js";

import { A2A_METHOD } from "../../subsystems/channels/peer-protocol.js";

import { ulid } from "../../utils/ulid.js";
import {
  A2A_HTTP_PROTOCOL_BINDING,
  type A2AListTasksOptions,
  type A2AListTasksResult,
} from "./types.js";

export interface A2AHttpClientOptions {
  baseUrl: string;
  token?: string;
  /** Timeout for request/response operations in milliseconds. */
  timeoutMs?: number;
}

export class A2AHttpClient {
  readonly baseUrl: string;
  private readonly _token?: string;
  private readonly _timeoutMs: number;
  private _cachedAgentCard?: AgentCard;
  /** Returns the most recently discovered AgentCard, if any. */
  get cachedAgentCard(): AgentCard | undefined {
    return this._cachedAgentCard;
  }
  private _interfaceUrl?: string;

  constructor(options: A2AHttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this._token = options.token;
    this._timeoutMs = options.timeoutMs ?? 30_000;
  }

  /**
   * Fetch and parse the remote agent's discovery card.
   */
  async discover(): Promise<AgentCard> {
    const discoveryUrl = `${this.baseUrl}/.well-known/agent-card.json`;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (this._token) {
      headers["x-control-token"] = this._token;
    }

    const res = await this._request({
      url: discoveryUrl,
      method: "GET",
      headers,
    });

    if (!res.ok) {
      throw new Error(
        `Failed to discover agent card at ${discoveryUrl}: ${res.status} ${res.text}`,
      );
    }

    const card = res.data as AgentCard;
    this._cachedAgentCard = card;

    // Resolve JSON-RPC endpoint from card if present
    const rpcIface = card.supportedInterfaces?.find(
      (iface) =>
        iface.protocolBinding === A2A_HTTP_PROTOCOL_BINDING ||
        iface.protocolBinding === "JSONRPC",
    );
    if (rpcIface?.url) {
      this._interfaceUrl = rpcIface.url;
    } else {
      this._interfaceUrl = `${this.baseUrl}/a2a`;
    }

    return card;
  }

  /**
   * Submit a task via SendMessage.
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    const res = await this._rpc(A2A_METHOD.SEND_MESSAGE, request);
    return res as SendMessageResponse;
  }

  /**
   * Retrieve a task by ID.
   */
  async getTask(taskId: string): Promise<A2ATask> {
    const res = await this._rpc(A2A_METHOD.GET_TASK, { taskId });
    return res as A2ATask;
  }

  /**
   * Cancel an active task.
   */
  async cancelTask(taskId: string, reason?: string): Promise<A2ATask> {
    const res = await this._rpc(A2A_METHOD.CANCEL_TASK, { taskId, reason });
    return res as A2ATask;
  }

  /**
   * List tasks on the remote agent.
   */
  async listTasks(options?: A2AListTasksOptions): Promise<A2AListTasksResult> {
    const res = await this._rpc("ListTasks", options ?? {});
    return res as A2AListTasksResult;
  }

  /**
   * Subscribe to task lifecycle events via Server-Sent Events (SSE).
   * Returns an unsubscribe function that terminates the stream.
   */
  subscribeToTask(
    taskId: string,
    onEvent: (event: any) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const sseUrl = `${this.baseUrl}/a2a/tasks/${encodeURIComponent(taskId)}`;
    const parsed = new URL(sseUrl);
    const client = parsed.protocol === "https:" ? https : http;

    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    };
    if (this._token) {
      headers["x-control-token"] = this._token;
    }

    let aborted = false;
    const req = client.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers,
      },
      (res) => {
        if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
          onError?.(
            new Error(`A2A SSE request failed with status ${res.statusCode}`),
          );
          res.resume();
          return;
        }
        let buffer = "";

        res.on("data", (chunk: Buffer) => {
          if (aborted) return;
          buffer += chunk.toString("utf8");

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data:")) {
              const dataContent = trimmed.slice(5).trim();
              if (dataContent) {
                try {
                  const parsedJson = JSON.parse(dataContent);
                  onEvent(parsedJson);
                } catch (error) {
                  onError?.(
                    error instanceof Error
                      ? error
                      : new Error("Invalid JSON in A2A SSE event"),
                  );
                }
              }
            }
          }
        });
        res.on("error", (error) => onError?.(error));
      },
    );

    req.on("error", (error) => onError?.(error));

    req.end();

    return () => {
      aborted = true;
      req.destroy();
    };
  }

  private _request(options: {
    url: string;
    method: "GET" | "POST";
    headers?: Record<string, string>;
    body?: string;
  }): Promise<{ status: number; ok: boolean; data: any; text: string }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(options.url);
      const transport = parsed.protocol === "https:" ? https : http;

      const req = transport.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: options.method,
          headers: options.headers,
        },
        (res) => {
          let rawData = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            rawData += chunk;
          });
          res.on("end", () => {
            const status = res.statusCode || 0;
            const ok = status >= 200 && status < 300;
            let parsedData = rawData;
            try {
              parsedData = JSON.parse(rawData);
            } catch (_) {}
            resolve({
              status,
              ok,
              data: parsedData,
              text: rawData,
            });
          });
        },
      );

      req.on("error", reject);
      req.setTimeout(this._timeoutMs, () => {
        req.destroy(
          new Error(`A2A request timed out after ${this._timeoutMs}ms`),
        );
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  private async _rpc(method: string, params?: unknown): Promise<unknown> {
    const targetUrl = this._interfaceUrl || `${this.baseUrl}/a2a`;

    const rpcReq: A2AJsonRpcRequest = {
      jsonrpc: "2.0",
      id: ulid(),
      method,
      params,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this._token) {
      headers["x-control-token"] = this._token;
    }

    const res = await this._request({
      url: targetUrl,
      method: "POST",
      headers,
      body: JSON.stringify(rpcReq),
    });

    if (!res.ok) {
      throw new Error(
        `A2A request failed (${res.status}): ${typeof res.data === "string" ? res.data : JSON.stringify(res.data)}`,
      );
    }

    const json = res.data as A2AJsonRpcResponse;

    if (json.error) {
      throw new Error(
        `A2A RPC error: ${json.error.message} (code: ${json.error.code})`,
      );
    }

    return json.result;
  }
}
