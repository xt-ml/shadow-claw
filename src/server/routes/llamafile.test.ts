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

    registerLlamafileRoutes(app as any, service, { verbose: false });
  });

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

  it("invokes llamafile in CLI mode", async () => {
    const handler = routes.get("POST /llamafile-proxy/chat/completions");
    service.getLlamafileRuntimeOptions.mockReturnValue({
      mode: "cli",
      offline: true,
    });

    const req = { body: { model: "model.llamafile" }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(service.invokeCli).toHaveBeenCalled();
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
      false,
    );
  });
});
