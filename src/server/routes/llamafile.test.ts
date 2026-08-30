import { jest } from "@jest/globals";

describe("llamafile-routes", () => {
  let routes: Map<string, any>;
  let service: any;
  let invokeLlamafileServerMock: any;

  function createResponse() {
    const res: any = {
      statusCode: 200,
      body: undefined,
      headers: {},
      headersSent: false,
      status: jest.fn().mockImplementation((code: any) => {
        res.statusCode = code;
        return res;
      }),
      json: jest.fn().mockImplementation((payload: any) => {
        res.body = payload;
        return res;
      }),
      write: jest.fn(),
      end: jest.fn(),
    };
    return res;
  }

  beforeEach(async () => {
    jest.resetModules();
    routes = new Map();
    service = {
      listBinaries: jest.fn(),
      getLlamafileRuntimeOptions: jest.fn(),
      invokeCli: jest.fn(),
      getLlamafileRequestId: jest.fn(),
      cancelRequest: jest.fn(),
    };
    invokeLlamafileServerMock = jest.fn();

    jest.unstable_mockModule("../services/llamafile-manager.js", () => ({
      invokeLlamafileServer: invokeLlamafileServerMock,
      LlamafileManagerService: jest.fn(),
    }));

    const { registerLlamafileRoutes } = await import("./llamafile.js");

    const app = {
      get: jest.fn((path: string, handler: any) => {
        routes.set(`GET ${path}`, handler);
      }),
      post: jest.fn((path: string, handler: any) => {
        routes.set(`POST ${path}`, handler);
      }),
    };

    registerLlamafileRoutes(app as any, service, { verbose: true });
  });

  describe("GET /llamafile-proxy/models", () => {
    it("lists local llamafile binaries", async () => {
      const handler = routes.get("GET /llamafile-proxy/models");
      service.listBinaries.mockResolvedValue([
        { id: "model.llamafile", fileName: "model.llamafile" },
      ]);

      const res = createResponse();
      await handler({}, res);

      expect(res.json).toHaveBeenCalledWith({
        data: [expect.objectContaining({ id: "model.llamafile" })],
      });
    });

    it("handles failure listing binaries with 502 status", async () => {
      const handler = routes.get("GET /llamafile-proxy/models");
      service.listBinaries.mockRejectedValue(new Error("Disk access denied"));

      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const res = createResponse();
      await handler({}, res);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.body.error).toContain(
        "Failed to list llamafile binaries: Disk access denied",
      );
      errSpy.mockRestore();
    });
  });

  describe("POST /llamafile-proxy/cancel", () => {
    it("returns 400 when request id is missing", async () => {
      const handler = routes.get("POST /llamafile-proxy/cancel");
      service.getLlamafileRequestId.mockReturnValue(undefined);

      const res = createResponse();
      await handler({ body: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.error).toContain("Missing llamafile request id");
    });

    it("returns 200 when request was not found or already completed", async () => {
      const handler = routes.get("POST /llamafile-proxy/cancel");
      service.getLlamafileRequestId.mockReturnValue("req-123");
      service.cancelRequest.mockReturnValue(false);

      const res = createResponse();
      await handler({ body: { id: "req-123" } }, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.body).toEqual({ ok: true, cancelled: false });
    });

    it("cancels an active llamafile request", async () => {
      const handler = routes.get("POST /llamafile-proxy/cancel");
      service.getLlamafileRequestId.mockReturnValue("req-123");
      service.cancelRequest.mockReturnValue(true);

      const req = { body: { id: "req-123" } };
      const res = createResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({ ok: true, cancelled: true });
    });
  });

  describe("POST /llamafile-proxy/chat/completions", () => {
    it("returns 400 when body is missing or not an object", async () => {
      const handler = routes.get("POST /llamafile-proxy/chat/completions");
      const res = createResponse();
      await handler({ body: null, headers: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.error).toBe("Missing request body");
    });

    it("returns 400 in CLI mode when model is missing", async () => {
      const handler = routes.get("POST /llamafile-proxy/chat/completions");
      service.getLlamafileRuntimeOptions.mockReturnValue({
        mode: "cli",
        offline: true,
      });

      const res = createResponse();
      await handler({ body: { model: "  " }, headers: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.error).toContain(
        "Missing or invalid 'model' parameter for CLI mode",
      );
    });

    it("invokes llamafile in CLI mode", async () => {
      const handler = routes.get("POST /llamafile-proxy/chat/completions");
      service.getLlamafileRuntimeOptions.mockReturnValue({
        mode: "cli",
        offline: true,
      });

      const req = {
        body: { model: "model.llamafile", llamafile: { mode: "cli" } },
        headers: { "x-llamafile-mode": "cli" },
      };
      const res = createResponse();

      await handler(req, res);

      expect(service.invokeCli).toHaveBeenCalledWith(
        req,
        res,
        req.body,
        { model: "model.llamafile", offline: true },
        true,
      );
    });

    it("invokes llamafile in SERVER mode", async () => {
      const handler = routes.get("POST /llamafile-proxy/chat/completions");
      service.getLlamafileRuntimeOptions.mockReturnValue({
        mode: "server",
        host: "127.0.0.1",
        port: 8080,
      });

      const req = { body: { model: "model.llamafile" }, headers: {} };
      const res = createResponse();

      await handler(req, res);

      expect(invokeLlamafileServerMock).toHaveBeenCalledWith(
        req,
        res,
        req.body,
        expect.objectContaining({ host: "127.0.0.1", port: 8080 }),
        true,
      );
    });

    it("handles invocation failure before headers sent with 502", async () => {
      const handler = routes.get("POST /llamafile-proxy/chat/completions");
      service.getLlamafileRuntimeOptions.mockReturnValue({
        mode: "cli",
      });
      service.invokeCli.mockRejectedValue(new Error("Process crashed"));

      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const req = { body: { model: "model.llamafile" }, headers: {} };
      const res = createResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.body.error).toContain(
        "Llamafile invocation failed: Process crashed",
      );
      errSpy.mockRestore();
    });

    it("handles invocation failure after headers sent by writing SSE error event", async () => {
      const handler = routes.get("POST /llamafile-proxy/chat/completions");
      service.getLlamafileRuntimeOptions.mockReturnValue({
        mode: "server",
        host: "127.0.0.1",
        port: 8080,
      });
      invokeLlamafileServerMock.mockImplementation(
        async (_req: any, res: any) => {
          res.headersSent = true;
          throw new Error("Stream broken midway");
        },
      );

      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const req = { body: { model: "model.llamafile" }, headers: {} };
      const res = createResponse();

      await handler(req, res);

      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Stream broken midway"'),
      );
      expect(res.write).toHaveBeenCalledWith("data: [DONE]\n\n");
      expect(res.end).toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });
});
