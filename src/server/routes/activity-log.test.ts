import { jest } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { registerActivityLogRoutes } from "./activity-log.js";

describe("activity-log routes", () => {
  function createResponse() {
    const res: any = {
      statusCode: 200,
      body: undefined,
      status: jest.fn().mockImplementation((code: any) => {
        res.statusCode = code;

        return res;
      }),
      json: jest.fn().mockImplementation((payload: any) => {
        res.body = payload;

        return res;
      }),
    };

    return res;
  }

  it("writes activity logs to disk and creates .cache/logs when missing", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "shadowclaw-log-"));
    const logsDir = path.join(tempRoot, ".cache", "logs");

    const routes = new Map<string, any>();
    const app = {
      post: jest.fn((routePath: string, handler: any) => {
        routes.set(routePath, handler);
      }),
    };

    registerActivityLogRoutes(app as any, { logsDir });

    const handler = routes.get("/activity-log");
    const req = {
      body: {
        groupId: "br:main",
        level: "debug",
        label: "Tool",
        message: "read_file started",
        sessionStartedAt: "2026-05-13T12:34:56.789Z",
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(fs.existsSync(logsDir)).toBe(true);

    const logFile = path.join(logsDir, "br_main__2026-05-13T12-34-56.789Z.log");
    expect(fs.existsSync(logFile)).toBe(true);

    const content = fs.readFileSync(logFile, "utf8");
    expect(content).toContain("br:main");
    expect(content).toContain("read_file started");
  });

  it("uses ISO-ms filename when no group id is provided", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "shadowclaw-log-"));
    const logsDir = path.join(tempRoot, ".cache", "logs");

    const routes = new Map<string, any>();
    const app = {
      post: jest.fn((routePath: string, handler: any) => {
        routes.set(routePath, handler);
      }),
    };

    registerActivityLogRoutes(app as any, { logsDir });

    const handler = routes.get("/activity-log");
    const req = {
      body: {
        level: "info",
        label: "Starting",
        message: "session start",
        sessionStartedAt: "2026-05-13T12:34:56.789Z",
      },
    };
    const res = createResponse();

    await handler(req, res);

    const logFile = path.join(logsDir, "2026-05-13T12-34-56.789Z.log");
    expect(fs.existsSync(logFile)).toBe(true);
  });
});
