import { jest } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { registerCspReportRoutes } from "./csp-report.js";

describe("csp-report routes", () => {
  it("writes csp reports to disk with dated log files and returns 204", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "shadowclaw-csp-"));
    const logsDir = path.join(tempRoot, ".cache", "logs");

    const routes = new Map<string, any>();
    const app = {
      post: jest.fn((routePath: string, ...handlers: any[]) => {
        routes.set(routePath, handlers[handlers.length - 1]);
      }),
    };

    const logger = {
      log: jest.fn(),
      error: jest.fn(),
    };

    registerCspReportRoutes(app as any, { logsDir, logger: logger as any });

    const handler = routes.get("/__cspreport");
    expect(handler).toBeDefined();

    const req = {
      body: {
        "csp-report": {
          "violated-directive": "require-trusted-types-for 'script'",
          "script-sample": "detailsEl.innerHTML",
        },
      },
    };

    const res = {
      sendStatus: jest.fn(),
    };

    handler(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(204);
    expect(fs.existsSync(logsDir)).toBe(true);

    const files = fs.readdirSync(logsDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(
      /^csp-reports__\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z\.log$/,
    );

    const content = fs.readFileSync(path.join(logsDir, files[0]), "utf8");
    expect(content).toContain("csp-report");
    expect(content).toContain("require-trusted-types-for 'script'");
  });
});
