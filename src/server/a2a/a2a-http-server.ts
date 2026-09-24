/**
 * A2A JSON-RPC 2.0 HTTP Server Handler.
 *
 * Implements server-side handling of A2A v1.0 standard methods:
 * - GetAgentCard
 * - SendMessage
 * - GetTask
 * - CancelTask
 * - ListTasks
 *
 * References:
 * - A2A v1.0 Specification §3.2, §4.4, §9.4
 * - ADR: docs/decisions/server-a2a-http-binding.md
 */

import type {
  AgentCard,
  A2AJsonRpcResponse,
  A2AMessage,
  SendMessageRequest,
} from "../../subsystems/channels/peer-protocol.js";

import {
  A2A_METHOD,
  A2A_ERROR_CODE,
  Role,
  TaskState,
  isJsonRpcRequest,
} from "../../subsystems/channels/peer-protocol.js";

import { ulid } from "../../utils/ulid.js";
import { A2ATaskStore } from "./a2a-task-store.js";
import type { A2ATaskExecutor } from "./types.js";

export interface A2AHttpServerOptions {
  agentCard: AgentCard;
  taskStore?: A2ATaskStore;
  taskExecutor?: A2ATaskExecutor;
}

export class A2AHttpServer {
  readonly agentCard: AgentCard;
  readonly taskStore: A2ATaskStore;
  private readonly _taskExecutor?: A2ATaskExecutor;

  constructor(options: A2AHttpServerOptions) {
    this.agentCard = options.agentCard;
    this.taskStore = options.taskStore ?? new A2ATaskStore();
    this._taskExecutor = options.taskExecutor;
  }

  /**
   * Handle an incoming A2A JSON-RPC 2.0 request.
   */
  async handleRequest(request: unknown): Promise<A2AJsonRpcResponse> {
    if (!isJsonRpcRequest(request)) {
      return {
        jsonrpc: "2.0",
        id: (request as any)?.id ?? "0",
        error: {
          code: A2A_ERROR_CODE.INVALID_REQUEST,
          message: "Invalid JSON-RPC 2.0 request",
        },
      };
    }

    const { id, method, params } = request;

    try {
      switch (method) {
        case A2A_METHOD.GET_AGENT_CARD: {
          return {
            jsonrpc: "2.0",
            id,
            result: this.agentCard,
          };
        }

        case A2A_METHOD.SEND_MESSAGE: {
          const sendReq = params as SendMessageRequest | undefined;
          if (!sendReq?.message) {
            return {
              jsonrpc: "2.0",
              id,
              error: {
                code: A2A_ERROR_CODE.INVALID_PARAMS,
                message: "Missing 'message' in SendMessage parameters",
              },
            };
          }

          const task = this.taskStore.createTask(sendReq);

          if (this._taskExecutor) {
            await this._taskExecutor(task, (state, message) => {
              this.taskStore.updateTaskStatus(task.id, state, message);
            });
          } else {
            // Default task execution stub: SUBMITTED -> WORKING -> COMPLETED
            this.taskStore.updateTaskStatus(task.id, TaskState.WORKING);

            const responseMsg: A2AMessage = {
              messageId: ulid(),
              role: Role.AGENT,
              parts: [
                { text: `A2A task ${task.id} acknowledged and processed.` },
              ],
              taskId: task.id,
              contextId: task.contextId,
            };

            this.taskStore.updateTaskStatus(
              task.id,
              TaskState.COMPLETED,
              responseMsg,
            );
          }

          const finalTask = this.taskStore.getTask(task.id) ?? task;
          return {
            jsonrpc: "2.0",
            id,
            result: {
              task: finalTask,
              message: finalTask.status.message,
            },
          };
        }

        case A2A_METHOD.GET_TASK: {
          const p = params as { taskId?: string; id?: string } | undefined;
          const taskId = p?.taskId ?? p?.id;
          if (!taskId) {
            return {
              jsonrpc: "2.0",
              id,
              error: {
                code: A2A_ERROR_CODE.INVALID_PARAMS,
                message: "Missing 'taskId' parameter",
              },
            };
          }

          const task = this.taskStore.getTask(taskId);
          if (!task) {
            return {
              jsonrpc: "2.0",
              id,
              error: {
                code: A2A_ERROR_CODE.TASK_NOT_FOUND,
                message: `Task ${taskId} not found`,
              },
            };
          }

          return {
            jsonrpc: "2.0",
            id,
            result: task,
          };
        }

        case A2A_METHOD.CANCEL_TASK: {
          const p = params as
            | { taskId?: string; id?: string; reason?: string }
            | undefined;
          const taskId = p?.taskId ?? p?.id;
          if (!taskId) {
            return {
              jsonrpc: "2.0",
              id,
              error: {
                code: A2A_ERROR_CODE.INVALID_PARAMS,
                message: "Missing 'taskId' parameter",
              },
            };
          }

          const existing = this.taskStore.getTask(taskId);
          if (!existing) {
            return {
              jsonrpc: "2.0",
              id,
              error: {
                code: A2A_ERROR_CODE.TASK_NOT_FOUND,
                message: `Task ${taskId} not found`,
              },
            };
          }

          try {
            const canceled = this.taskStore.cancelTask(taskId, p?.reason);
            return {
              jsonrpc: "2.0",
              id,
              result: canceled,
            };
          } catch (err: any) {
            return {
              jsonrpc: "2.0",
              id,
              error: {
                code: A2A_ERROR_CODE.TASK_NOT_CANCELABLE,
                message: err?.message ?? `Task ${taskId} is not cancelable`,
              },
            };
          }
        }

        case "ListTasks": {
          const p = params as any;
          const result = this.taskStore.listTasks(p);
          return {
            jsonrpc: "2.0",
            id,
            result,
          };
        }

        default: {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: A2A_ERROR_CODE.METHOD_NOT_FOUND,
              message: `Method ${method} not found`,
            },
          };
        }
      }
    } catch (err: any) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: A2A_ERROR_CODE.INTERNAL_ERROR,
          message: err?.message ?? "Internal error processing A2A request",
        },
      };
    }
  }
}
