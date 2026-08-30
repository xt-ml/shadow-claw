/** @jest-environment node */
import { jest } from "@jest/globals";
import { EventEmitter } from "node:events";

describe("LlamafileManagerService", () => {
  let spawnMock: any;
  let statMock: any;
  let readdirMock: any;
  let accessMock: any;

  beforeEach(async () => {
    jest.resetModules();

    spawnMock = jest.fn();
    statMock = jest.fn();
    readdirMock = jest.fn();
    accessMock = jest.fn();

    jest.unstable_mockModule("node:child_process", () => ({
      spawn: spawnMock,
    }));

    jest.unstable_mockModule("node:fs/promises", () => ({
      stat: statMock,
      readdir: readdirMock,
      access: accessMock,
    }));
  });

  async function getService() {
    const mod = await import("./llamafile-manager.js");

    return mod.createLlamafileManagerService();
  }

  describe("listBinaries & resolveBinary", () => {
    it("lists .llamafile files in the cache directory", async () => {
      statMock.mockResolvedValue({ isDirectory: () => true });
      readdirMock.mockResolvedValue([
        { name: "model1.llamafile", isFile: () => true },
        { name: "model2.llamafile", isFile: () => true },
        { name: "other.txt", isFile: () => true },
      ]);

      const service = await getService();
      const binaries = await service.listBinaries();

      expect(binaries).toHaveLength(2);
      expect(binaries[0].id).toBe("model1");
      expect(binaries[1].id).toBe("model2");

      const resolved = await service.resolveBinary("model1");
      expect(resolved.fileName).toBe("model1.llamafile");
    });

    it("throws error if model is not found", async () => {
      statMock.mockResolvedValue({ isDirectory: () => true });
      readdirMock.mockResolvedValue([
        { name: "model1.llamafile", isFile: () => true },
      ]);

      const service = await getService();
      await expect(service.resolveBinary("missing")).rejects.toThrow(
        /not found under assets\/cache\/llamafile/,
      );
    });

    it("throws error if no cache directory is found", async () => {
      statMock.mockRejectedValue(new Error("Not found"));

      const service = await getService();
      await expect(service.listBinaries()).rejects.toThrow(
        /Could not locate assets\/cache\/llamafile directory/,
      );
    });
  });

  describe("getLlamafileRuntimeOptions & Host Validation", () => {
    it("parses options from headers", async () => {
      const service = await getService();
      const req = {
        headers: {
          "x-llamafile-mode": "cli",
          "x-llamafile-host": "127.0.0.1",
          "x-llamafile-port": "8080",
          "x-llamafile-offline": "true",
        },
        body: {},
      } as any;

      const opts = service.getLlamafileRuntimeOptions(req);
      expect(opts.mode).toBe("cli");
      expect(opts.host).toBe("127.0.0.1");
      expect(opts.port).toBe(8080);
      expect(opts.offline).toBe(true);
    });

    it("parses options from body", async () => {
      const service = await getService();
      const req = {
        headers: {},
        body: {
          llamafile: {
            mode: "server",
            host: "localhost",
            port: "9090",
            offline: false,
          },
        },
      } as any;

      const opts = service.getLlamafileRuntimeOptions(req);
      expect(opts.mode).toBe("server");
      expect(opts.host).toBe("localhost");
      expect(opts.port).toBe(9090);
      expect(opts.offline).toBe(false);
    });

    it("rejects non-loopback hosts by default", async () => {
      const service = await getService();
      const req = {
        headers: {
          "x-llamafile-host": "192.168.1.100",
        },
        body: {},
      } as any;

      expect(() => service.getLlamafileRuntimeOptions(req)).toThrow(
        /Unsafe host '192.168.1.100'/,
      );
    });
  });

  describe("cancelRequest and request ID", () => {
    it("extracts request ID from header and body", async () => {
      const service = await getService();
      const reqWithHeader = {
        headers: { "x-shadowclaw-request-id": "req-123" },
      } as any;
      expect(service.getLlamafileRequestId(reqWithHeader)).toBe("req-123");

      const reqWithBody = {
        headers: {},
        body: { requestId: "req-456" },
      } as any;
      expect(service.getLlamafileRequestId(reqWithBody, reqWithBody.body)).toBe(
        "req-456",
      );
    });

    it("cancels active requests", async () => {
      const service = await getService();
      expect(service.cancelRequest("non-existent")).toBe(false);

      const cancelFn = jest.fn();
      service.__getActiveRequests().set("req-cancel", cancelFn);

      expect(service.cancelRequest("req-cancel")).toBe(true);
      expect(cancelFn).toHaveBeenCalled();
    });
  });

  describe("createLlamafilePromptEchoFilter & stripLlamafilePromptEcho", () => {
    it("strips echoed prompt from output", async () => {
      const { createLlamafilePromptEchoFilter, stripLlamafilePromptEcho } =
        await import("./llamafile-manager.js");
      const prompt = "USER: hello\n\nASSISTANT:";
      const filter = createLlamafilePromptEchoFilter(prompt);

      expect(filter.push(prompt)).toBe("");
      expect(filter.push(" Hello there!")).toBe(" Hello there!");
      expect(filter.flush()).toBe("");

      const stripped = stripLlamafilePromptEcho(
        "USER: hello\n\nASSISTANT: Hello there!",
        prompt,
      );
      expect(stripped).toBe("Hello there!");
    });

    it("handles partial echoes", async () => {
      const { createLlamafilePromptEchoFilter } =
        await import("./llamafile-manager.js");
      const prompt = "USER: hello\n\nASSISTANT:";
      const filter = createLlamafilePromptEchoFilter(prompt);

      expect(filter.push("USER: ")).toBe("");
      expect(filter.push("hello\n\nASSISTANT: Hi")).toBe(" Hi");
    });
  });

  describe("invokeCli", () => {
    it("spawns llamafile process and streams output", async () => {
      const service = await getService();

      statMock.mockResolvedValue({ isDirectory: () => true });
      readdirMock.mockResolvedValue([
        { name: "test.llamafile", isFile: () => true },
      ]);
      accessMock.mockResolvedValue(undefined);

      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.pid = 1234;
      child.kill = jest.fn();
      child.exitCode = null;
      child.signalCode = null;
      child.killed = false;

      spawnMock.mockImplementation(() => {
        queueMicrotask(() => child.emit("spawn"));

        return child;
      });

      const req: any = new EventEmitter();
      req.headers = {};
      req.socket = new EventEmitter();

      const res = Object.assign(new EventEmitter(), {
        write: jest.fn(),
        end: jest.fn(),
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }) as any;

      const body = {
        model: "test",
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      };

      const promise = service.invokeCli(
        req,
        res,
        body,
        { model: "test", offline: false },
        false,
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      child.stdout.emit(
        "data",
        Buffer.from("USER: hi\n\nASSISTANT: Hello world", "utf8"),
      );
      child.emit("close", 0);

      await promise;

      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining("Hello world"),
      );
      expect(res.end).toHaveBeenCalled();
    });

    it("handles non-streaming responses and parses tool calls", async () => {
      const service = await getService();

      statMock.mockResolvedValue({ isDirectory: () => true });
      readdirMock.mockResolvedValue([
        { name: "test.llamafile", isFile: () => true },
      ]);
      accessMock.mockResolvedValue(undefined);

      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.pid = 1234;
      child.kill = jest.fn();
      child.exitCode = null;
      child.signalCode = null;
      child.killed = false;

      spawnMock.mockImplementation(() => {
        queueMicrotask(() => child.emit("spawn"));

        return child;
      });

      const req: any = new EventEmitter();
      req.headers = {};
      req.socket = new EventEmitter();

      const res = Object.assign(new EventEmitter(), {
        write: jest.fn(),
        end: jest.fn(),
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }) as any;

      const body = {
        model: "test",
        messages: [{ role: "user", content: "hi" }],
        stream: false,
      };

      const promise = service.invokeCli(
        req,
        res,
        body,
        { model: "test", offline: false },
        false,
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      child.stdout.emit(
        "data",
        Buffer.from(
          'USER: hi\n\nASSISTANT: call:web_search{"query":"test"}',
          "utf8",
        ),
      );
      child.emit("close", 0);

      await promise;

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          choices: expect.arrayContaining([
            expect.objectContaining({
              message: expect.objectContaining({
                tool_calls: expect.arrayContaining([
                  expect.objectContaining({
                    function: expect.objectContaining({ name: "web_search" }),
                  }),
                ]),
              }),
            }),
          ]),
        }),
      );
    });

    it("throws error when binary is not executable", async () => {
      const service = await getService();
      statMock.mockResolvedValue({ isDirectory: () => true });
      readdirMock.mockResolvedValue([
        { name: "test.llamafile", isFile: () => true },
      ]);
      accessMock.mockRejectedValue(new Error("EACCES: permission denied"));

      const req: any = { headers: {} };
      const res: any = {};

      await expect(
        service.invokeCli(
          req,
          res,
          { model: "test", messages: [{ role: "user", content: "hi" }] },
          { model: "test", offline: false },
          false,
        ),
      ).rejects.toThrow(/Binary not executable or not found/);
    });

    it("cancels active requests and extracts request IDs", async () => {
      const service = await getService();

      // 1. cancelRequest
      expect(service.cancelRequest("non-existent")).toBe(false);

      const cancelFn = jest.fn(() => {
        service.__getActiveRequests().delete("req-123");
      });
      service.__getActiveRequests().set("req-123", cancelFn);
      expect(service.cancelRequest("req-123")).toBe(true);
      expect(cancelFn).toHaveBeenCalled();
      expect(service.__getActiveRequests().has("req-123")).toBe(false);

      // 2. getLlamafileRequestId
      const reqWithHeader = {
        headers: { "x-shadowclaw-request-id": "header-id" },
      } as any;
      expect(service.getLlamafileRequestId(reqWithHeader)).toBe("header-id");

      const reqWithBody = { headers: {} } as any;
      const bodyWithId = { requestId: "body-id" };
      expect(service.getLlamafileRequestId(reqWithBody, bodyWithId)).toBe(
        "body-id",
      );
    });

    it("handles invokeLlamafileServer forwarding", async () => {
      const { invokeLlamafileServer } = await import("./llamafile-manager.js");

      const req: any = { headers: {} };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };

      // Mock fetch response for server error
      (global.fetch as any) = jest.fn<any>().mockResolvedValue({
        ok: false,
        status: 502,
        headers: new Headers({ "x-custom": "test" }),
        text: async () => "Bad Gateway",
      });

      await invokeLlamafileServer(
        req,
        res,
        { model: "custom-model", messages: [] },
        { host: "127.0.0.1", port: 8080 },
        false,
      );

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.send).toHaveBeenCalledWith("Bad Gateway");
    });
  });
});
