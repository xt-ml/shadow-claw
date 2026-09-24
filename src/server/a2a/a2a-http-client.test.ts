import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { registerA2ARoutes } from "./routes.js";
import { A2AHttpServer } from "./a2a-http-server.js";
import { A2ATaskStore } from "./a2a-task-store.js";
import { buildHttpAgentCard } from "./agent-card-builder.js";
import { A2AHttpClient } from "./a2a-http-client.js";
import { Role, TaskState } from "../../subsystems/channels/peer-protocol.js";

describe("A2AHttpClient & Server-to-Server Collaboration", () => {
  let serverApp: express.Express;
  let server: http.Server;
  let port: number;
  let taskStore: A2ATaskStore;
  let a2aServer: A2AHttpServer;
  const token = "mesh-token-456";

  beforeAll(async () => {
    serverApp = express();
    serverApp.use(express.json());

    taskStore = new A2ATaskStore();

    await new Promise<void>((resolve) => {
      server = serverApp.listen(0, "127.0.0.1", () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });

    const card = buildHttpAgentCard({
      baseUrl: `http://127.0.0.1:${port}`,
      name: "Remote Worker Node",
      version: "1.0.0",
      skills: [
        {
          id: "data_transform",
          name: "Data Transformation",
          description: "Transforms tabular data",
          tags: ["data"],
        },
      ],
    });

    a2aServer = new A2AHttpServer({
      agentCard: card,
      taskStore,
    });

    registerA2ARoutes(serverApp, {
      httpServer: a2aServer,
      token,
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("discovers remote agent card via discover()", async () => {
    const client = new A2AHttpClient({
      baseUrl: `http://127.0.0.1:${port}`,
      token,
    });

    const card = await client.discover();
    expect(card.name).toBe("Remote Worker Node");
    expect(card.skills).toHaveLength(1);
    expect(card.skills[0].id).toBe("data_transform");
    expect(card.supportedInterfaces[0].url).toBe(
      `http://127.0.0.1:${port}/a2a`,
    );
  });

  it("sends a message and receives task execution result", async () => {
    const client = new A2AHttpClient({
      baseUrl: `http://127.0.0.1:${port}`,
      token,
    });

    const response = await client.sendMessage({
      message: {
        messageId: "client-msg-1",
        role: Role.USER,
        parts: [{ text: "Please process dataset #42" }],
      },
    });

    expect(response.task).toBeDefined();
    expect(response.task!.status.state).toBe(TaskState.COMPLETED);
    expect(response.task!.history).toHaveLength(2);
    expect(response.task!.history![1].role).toBe(Role.AGENT);
  });

  it("retrieves a task via getTask()", async () => {
    const client = new A2AHttpClient({
      baseUrl: `http://127.0.0.1:${port}`,
      token,
    });

    const task = taskStore.createTask({
      message: {
        messageId: "manual-1",
        role: Role.USER,
        parts: [{ text: "Manual" }],
      },
    });

    const fetched = await client.getTask(task.id);
    expect(fetched.id).toBe(task.id);
    expect(fetched.status.state).toBe(TaskState.SUBMITTED);
  });

  it("cancels an active task via cancelTask()", async () => {
    const client = new A2AHttpClient({
      baseUrl: `http://127.0.0.1:${port}`,
      token,
    });

    const task = taskStore.createTask({
      message: {
        messageId: "cancel-me",
        role: Role.USER,
        parts: [{ text: "Cancel me" }],
      },
    });

    const canceled = await client.cancelTask(task.id);
    expect(canceled.status.state).toBe(TaskState.CANCELED);
  });

  it("subscribes to task updates via SSE", async () => {
    const client = new A2AHttpClient({
      baseUrl: `http://127.0.0.1:${port}`,
      token,
    });

    const task = taskStore.createTask({
      message: {
        messageId: "stream-me",
        role: Role.USER,
        parts: [{ text: "Stream me" }],
      },
    });

    const events: any[] = [];
    const unsubscribe = client.subscribeToTask(task.id, (event) => {
      events.push(event);
    });

    // Allow connection to establish
    await new Promise((r) => setTimeout(r, 50));

    taskStore.updateTaskStatus(task.id, TaskState.WORKING);
    taskStore.updateTaskStatus(task.id, TaskState.COMPLETED);

    // Wait for events to arrive over SSE
    await new Promise((r) => setTimeout(r, 100));

    unsubscribe();

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(
      events.some(
        (e) =>
          e.payload?.status?.state === TaskState.WORKING ||
          e.status?.state === TaskState.WORKING,
      ),
    ).toBe(true);
  });

  it("throws descriptive error when JSON-RPC returns error", async () => {
    const client = new A2AHttpClient({
      baseUrl: `http://127.0.0.1:${port}`,
      token,
    });

    await expect(client.getTask("non-existent-task-xyz")).rejects.toThrow(
      /TASK_NOT_FOUND|-32001/i,
    );
  });

  it("reports SSE request failures to the subscriber", async () => {
    const client = new A2AHttpClient({
      baseUrl: `http://127.0.0.1:${port}`,
      token,
    });
    const errors: Error[] = [];

    const unsubscribe = client.subscribeToTask(
      "non-existent-task-xyz",
      () => undefined,
      (error) => errors.push(error),
    );

    await new Promise((r) => setTimeout(r, 50));
    unsubscribe();

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/SSE request failed with status 404/);
  });
});
