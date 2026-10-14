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

      const resolvedWithPrefix = await service.resolveBinary(
        "mozilla-ai/model1.llamafile",
      );
      expect(resolvedWithPrefix.fileName).toBe("model1.llamafile");
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

    it("handles invokeLlamafileServer streaming success", async () => {
      const { invokeLlamafileServer } = await import("./llamafile-manager.js");

      const req: any = { headers: {} };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        write: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      const chunks = [
        new TextEncoder().encode(
          'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
        ),
      ];
      let readIndex = 0;
      const mockReader = {
        read: jest.fn(async () => {
          if (readIndex < chunks.length) {
            return { done: false, value: chunks[readIndex++] };
          }
          return { done: true, value: undefined };
        }),
        releaseLock: jest.fn(),
      };

      (global.fetch as any) = jest.fn<any>().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/event-stream" }),
        body: {
          getReader: () => mockReader,
        },
      });

      await invokeLlamafileServer(
        req,
        res,
        { model: "custom-model", messages: [], stream: true },
        { host: "127.0.0.1", port: 8080 },
        true,
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.write).toHaveBeenCalled();
      expect(res.end).toHaveBeenCalled();
      expect(mockReader.releaseLock).toHaveBeenCalled();
    });

    it("handles invokeLlamafileServer non-streaming success", async () => {
      const { invokeLlamafileServer } = await import("./llamafile-manager.js");

      const req: any = { headers: {} };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };

      const jsonStr = JSON.stringify({
        choices: [{ message: { content: "Hello" } }],
      });
      (global.fetch as any) = jest.fn<any>().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        arrayBuffer: async () => Buffer.from(jsonStr),
      });

      await invokeLlamafileServer(
        req,
        res,
        { model: "custom-model", messages: [] },
        { host: "127.0.0.1", port: 8080 },
        false,
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalled();
    });

    it("handles invokeLlamafileServer fetch error when headers not sent", async () => {
      const { invokeLlamafileServer } = await import("./llamafile-manager.js");

      const req: any = { headers: {} };
      const res: any = {
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      (global.fetch as any) = jest
        .fn<any>()
        .mockRejectedValue(new Error("Connection refused"));

      await invokeLlamafileServer(
        req,
        res,
        { model: "custom-model", messages: [] },
        { host: "127.0.0.1", port: 8080 },
        false,
      );

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("Connection refused"),
        }),
      );
    });

    it("handles invokeLlamafileServer fetch error when headers already sent", async () => {
      const { invokeLlamafileServer } = await import("./llamafile-manager.js");

      const req: any = { headers: {} };
      const res: any = {
        headersSent: true,
        write: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      (global.fetch as any) = jest
        .fn<any>()
        .mockRejectedValue(new Error("Mid-stream abort"));

      await invokeLlamafileServer(
        req,
        res,
        { model: "custom-model", messages: [] },
        { host: "127.0.0.1", port: 8080 },
        false,
      );

      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining("Mid-stream abort"),
      );
      expect(res.end).toHaveBeenCalled();
    });

    it("rejects immediately if request is already destroyed or aborted before spawn", async () => {
      statMock.mockResolvedValue({ isDirectory: () => true });
      readdirMock.mockResolvedValue([
        { name: "model1.llamafile", isFile: () => true },
      ]);
      accessMock.mockResolvedValue(undefined);

      const service = await getService();
      const mockReq: any = new EventEmitter();
      mockReq.destroyed = true;
      mockReq.headers = {};
      mockReq.socket = new EventEmitter();

      const mockRes: any = new EventEmitter();

      await expect(
        service.invokeCli(
          mockReq,
          mockRes,
          {
            model: "model1",
            messages: [{ role: "user", content: "hello" }],
          },
          { model: "model1", offline: false },
          false,
        ),
      ).rejects.toThrow(/already closed or aborted/);

      expect(spawnMock).not.toHaveBeenCalled();
    });

    it("terminates all active processes and requests with terminateAll()", async () => {
      const { cleanupAllLlamafileProcesses, killChildProcessSync } =
        await import("./llamafile-manager.js");

      const killSpy = jest
        .spyOn(process, "kill")
        .mockImplementation(() => true);

      const fakeChild: any = new EventEmitter();
      fakeChild.pid = 9999;
      fakeChild.exitCode = null;
      fakeChild.signalCode = null;
      fakeChild.killed = false;

      // Test killChildProcessSync
      killChildProcessSync(fakeChild, true);
      expect(killSpy).toHaveBeenCalledWith(-9999, "SIGKILL");
      expect(killSpy).toHaveBeenCalledWith(9999, "SIGKILL");

      cleanupAllLlamafileProcesses();

      killSpy.mockRestore();
    });
  });

  describe("Local Binary Drivers & Built-in Tools (Llamafile and Agentfile)", () => {
    it("exports drivers and resolves drivers by binary extension or name", async () => {
      const {
        getBinaryDriver,
        resolveBinaryDriver,
        LLAMAFILE_BUILTIN_TOOLS,
        AGENTFILE_BUILTIN_TOOLS,
      } = await import("./llamafile-manager.js");

      const llamaDriver = getBinaryDriver("llamafile");
      expect(llamaDriver).toBeDefined();
      expect(llamaDriver?.extension).toBe(".llamafile");
      expect(llamaDriver?.kind).toBe("llamafile");

      const agentDriver = getBinaryDriver("agentfile");
      expect(agentDriver).toBeDefined();
      expect(agentDriver?.extension).toBe(".agentfile");
      expect(agentDriver?.kind).toBe("agentfile");

      expect(resolveBinaryDriver("my-model.llamafile")?.kind).toBe("llamafile");
      expect(resolveBinaryDriver("my-agent.agentfile")?.kind).toBe("agentfile");

      expect(LLAMAFILE_BUILTIN_TOOLS.map((t: any) => t.name)).toEqual(
        expect.arrayContaining([
          "read_file",
          "file_glob_search",
          "grep_search",
          "exec_shell_command",
          "write_file",
          "edit_file",
          "get_datetime",
          "get_info",
        ]),
      );

      expect(AGENTFILE_BUILTIN_TOOLS.map((t: any) => t.name)).toEqual(
        expect.arrayContaining([
          "read_file",
          "file_glob_search",
          "grep_search",
          "exec_shell_command",
          "write_file",
          "edit_file",
          "get_datetime",
          "get_info",
          "http_fetch",
          "web_search",
        ]),
      );
    });

    it("listTools returns built-in tools in CLI mode", async () => {
      const service = await getService();
      const tools = await service.listTools({ mode: "cli" });
      expect(tools.length).toBeGreaterThanOrEqual(8);
      const names = tools.map((t: any) => t.name);
      expect(names).toContain("read_file");
      expect(names).toContain("get_datetime");
    });

    it("listTools proxies to upstream /tools in server mode, and falls back to built-in if 403", async () => {
      const service = await getService();

      (global.fetch as any) = jest.fn<any>().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            type: "function",
            function: { name: "custom_server_tool", description: "custom" },
          },
        ],
      });

      const serverTools = await service.listTools({
        mode: "server",
        host: "127.0.0.1",
        port: 8080,
      });
      expect(serverTools).toHaveLength(1);
      expect(serverTools[0].function.name).toBe("custom_server_tool");

      // Upstream returns 403 (tools disabled on server) -> fallback to built-in list
      (global.fetch as any) = jest.fn<any>().mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const fallbackTools = await service.listTools({
        mode: "server",
        host: "127.0.0.1",
        port: 8080,
      });
      expect(fallbackTools.length).toBeGreaterThanOrEqual(8);
      expect(fallbackTools.map((t: any) => t.name)).toContain("read_file");
    });

    it("executeTool forwards to upstream /tools in server mode", async () => {
      const service = await getService();

      (global.fetch as any) = jest.fn<any>().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ output: "2026-10-12T00:00:00Z" }),
      });

      const result = await service.executeTool(
        "get_datetime",
        {},
        { mode: "server", host: "127.0.0.1", port: 8080 },
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:8080/tools",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "get_datetime", arguments: {} }),
        }),
      );
      expect(result).toEqual({ output: "2026-10-12T00:00:00Z" });
    });

    it("listTools extracts tools from object with tools or data property", async () => {
      const service = await getService();

      (global.fetch as any) = jest.fn<any>().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ tools: [{ name: "t_prop" }] }),
      });

      const res1 = await service.listTools({ mode: "server" });
      expect(res1).toEqual([{ name: "t_prop" }]);

      (global.fetch as any) = jest.fn<any>().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ name: "d_prop" }] }),
      });

      const res2 = await service.listTools({ mode: "server" });
      expect(res2).toEqual([{ name: "d_prop" }]);
    });

    it("executeTool handles error from upstream in server mode", async () => {
      const service = await getService();

      (global.fetch as any) = jest.fn<any>().mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal tool failure",
      });

      await expect(
        service.executeTool("custom_tool", {}, { mode: "server" }),
      ).rejects.toThrow(
        "Upstream /tools returned HTTP 500: Internal tool failure",
      );
    });

    it("executeTool handles local get_info and unsupported tools in CLI mode", async () => {
      const service = await getService();

      const info = await service.executeTool("get_info", {}, { mode: "cli" });
      expect(info.platform).toBe(process.platform);
      expect(info.cwd).toBe(process.cwd());

      await expect(
        service.executeTool("unsupported_action", {}, { mode: "cli" }),
      ).rejects.toThrow(/requires server mode or is not supported locally/);
    });

    it("terminateAll calls cancellation handlers and cleans up processes", async () => {
      const service = await getService();
      const cancelFn = jest.fn();
      service.__getActiveRequests().set("test-cancel", cancelFn);

      service.terminateAll();
      expect(cancelFn).toHaveBeenCalled();
    });
  });

  describe("buildCliPrompt with tools support", () => {
    it("injects tool definitions into prompt when tools are provided", async () => {
      const { buildCliPrompt } = await import("./llamafile-manager.js");

      const promptWithoutTools = buildCliPrompt({
        messages: [{ role: "user", content: "What is the time?" }],
      });
      expect(promptWithoutTools).not.toContain("# Tools");

      const promptWithTools = buildCliPrompt({
        messages: [{ role: "user", content: "What is the time?" }],
        tools: [
          {
            type: "function",
            function: {
              name: "get_datetime",
              description: "Get server time",
              parameters: { type: "object", properties: {} },
            },
          },
        ],
      });

      expect(promptWithTools).toContain("get_datetime");
      expect(promptWithTools).toContain("Get server time");
      expect(promptWithTools).toContain("USER: What is the time?");
      expect(promptWithTools).toContain("ASSISTANT:");
    });

    it("handles complex array content in buildCliPrompt", async () => {
      const { buildCliPrompt } = await import("./llamafile-manager.js");
      const prompt = buildCliPrompt({
        messages: [
          {
            role: "user",
            content: [
              "string block",
              { type: "text", text: "text block" },
              { type: "tool_result", content: "result content" },
              { type: "tool_use", name: "bash", input: { command: "ls" } },
              null as any,
            ],
          },
        ],
      });
      expect(prompt).toContain("string block");
      expect(prompt).toContain("text block");
      expect(prompt).toContain("result content");
      expect(prompt).toContain('[tool_use:bash] {"command":"ls"}');
    });
  });

  describe("buildLlamafileArgs, buildAgentfileArgs and binary drivers", () => {
    it("tests getBuiltinTools and binary drivers buildArgs / buildCliArgs", async () => {
      const { getBuiltinTools, getBinaryDriver, buildAgentfileArgs } =
        await import("./llamafile-manager.js");

      expect(getBuiltinTools("llamafile")).toBeDefined();
      expect(getBuiltinTools("agentfile")).toBeDefined();

      const llamaDriver = getBinaryDriver("llamafile");
      expect(llamaDriver).toBeDefined();
      const llamaArgs = llamaDriver!.buildArgs!({
        prompt: "hello llama",
        nPredict: 256,
        ctxSize: 4096,
        offline: true,
      });
      expect(llamaArgs).toContain("--offline");
      expect(llamaArgs).toContain("hello llama");

      const llamaCliArgs = llamaDriver!.buildCliArgs!({
        prompt: "cli hello",
      });
      expect(llamaCliArgs).toContain("cli hello");

      const agentDriver = getBinaryDriver("agentfile");
      expect(agentDriver).toBeDefined();
      const agentArgs = agentDriver!.buildArgs!({
        prompt: "hello agent",
        tools: ["bash"],
        modelPath: "/path/to/model",
        runtimeOptions: {
          systemPrompt: "system text",
          confirm: true,
          toolsRuntime: "node",
          searxngUrl: "http://searxng.local",
          sessionFile: "sess.json",
          traceFile: "trace.json",
          maxIterations: 5,
          think: true,
        },
      });
      expect(agentArgs).toContain("-m");
      expect(agentArgs).toContain("/path/to/model");
      expect(agentArgs).toContain("-s");
      expect(agentArgs).toContain("system text");
      expect(agentArgs).toContain("--tools");
      expect(agentArgs).toContain("bash");
      expect(agentArgs).toContain("--confirm");
      expect(agentArgs).toContain("--tools-runtime");
      expect(agentArgs).toContain("--searxng-url");
      expect(agentArgs).toContain("--session");
      expect(agentArgs).toContain("--trace");
      expect(agentArgs).toContain("--max-iterations");
      expect(agentArgs).toContain("--think");

      const agentCliArgs = agentDriver!.buildCliArgs!({
        prompt: "agent cli",
        tools: [],
        runtimeOptions: {
          confirm: false,
        },
      });
      expect(agentCliArgs).toContain("--tools");
      expect(agentCliArgs).toContain("none");
      expect(agentCliArgs).toContain("--yes");

      const toolsArrayArgs = buildAgentfileArgs({
        prompt: "tool array",
        tools: [{ name: "tool_a" }, { function: { name: "tool_b" } }],
      });
      expect(toolsArrayArgs).toContain("tool_a,tool_b");

      const toolsFromRuntime = buildAgentfileArgs({
        prompt: "runtime tools",
        runtimeOptions: { tools: "custom_runtime_tools" },
      });
      expect(toolsFromRuntime).toContain("custom_runtime_tools");
    });

    it("executes get_datetime in CLI mode and accesses active processes", async () => {
      const service = await getService();
      const dt = await service.executeTool("get_datetime", {}, { mode: "cli" });
      expect(dt).toHaveProperty("datetime");
      expect(service.__getActiveProcesses()).toBeDefined();
    });

    it("filters transport headers in invokeLlamafileServer", async () => {
      const { invokeLlamafileServer } = await import("./llamafile-manager.js");

      const req: any = { headers: {} };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };

      const upstreamHeaders = new Headers({
        "Content-Encoding": "gzip",
        "Transfer-Encoding": "chunked",
        "Content-Length": "1234",
        Connection: "close",
        "X-Custom-Header": "custom-val",
      });

      (global.fetch as any) = jest.fn<any>().mockResolvedValue({
        ok: true,
        status: 200,
        headers: upstreamHeaders,
        arrayBuffer: async () => Buffer.from("response"),
      });

      await invokeLlamafileServer(
        req,
        res,
        { model: "custom-model", messages: [] },
        { host: "127.0.0.1", port: 8080 },
        false,
      );

      expect(res.setHeader).toHaveBeenCalledWith(
        "x-custom-header",
        "custom-val",
      );
      expect(res.setHeader).not.toHaveBeenCalledWith(
        "content-encoding",
        expect.anything(),
      );
      expect(res.setHeader).not.toHaveBeenCalledWith(
        "content-length",
        expect.anything(),
      );
    });
  });

  describe("invokeCli multi-tool calls and stream filtering", () => {
    it("parses multiple tool calls from output in non-streaming mode", async () => {
      statMock.mockResolvedValue({ isDirectory: () => true });
      readdirMock.mockResolvedValue([
        { name: "model1.llamafile", isFile: () => true },
      ]);
      accessMock.mockResolvedValue(undefined);

      const service = await getService();

      const fakeChild: any = new EventEmitter();
      fakeChild.pid = 1234;
      fakeChild.stdout = new EventEmitter();
      fakeChild.stderr = new EventEmitter();
      fakeChild.exitCode = null;
      fakeChild.signalCode = null;
      fakeChild.killed = false;

      spawnMock.mockImplementation(() => {
        queueMicrotask(() => fakeChild.emit("spawn"));
        return fakeChild;
      });

      const mockReq: any = new EventEmitter();
      mockReq.headers = {};
      mockReq.socket = new EventEmitter();

      const res = Object.assign(new EventEmitter(), {
        statusCode: 200,
        body: undefined as any,
        json: jest.fn((val: any) => {
          res.body = val;
        }),
        status: jest.fn().mockReturnThis(),
      }) as any;

      const invokePromise = service.invokeCli(
        mockReq,
        res,
        {
          model: "model1",
          messages: [{ role: "user", content: "read files" }],
          tools: [{ name: "read_file", description: "read file" }],
        },
        { model: "model1", offline: false },
        false,
      );

      // Simulate model output with two tool calls in Gemma 4 syntax
      setImmediate(() => {
        fakeChild.stdout.emit(
          "data",
          Buffer.from(
            'call:read_file{path:"a.txt"} call:read_file{path:"b.txt"}',
          ),
        );
        fakeChild.emit("close", 0);
      });

      await invokePromise;

      expect(res.json).toHaveBeenCalled();
      const choice = res.body.choices[0];
      expect(choice.finish_reason).toBe("tool_calls");
      expect(choice.message.tool_calls).toHaveLength(2);
      expect(choice.message.tool_calls[0].function.name).toBe("read_file");
      expect(choice.message.tool_calls[0].function.arguments).toBe(
        '{"path":"a.txt"}',
      );
      expect(choice.message.tool_calls[1].function.arguments).toBe(
        '{"path":"b.txt"}',
      );
    });

    it("suppresses raw tool call syntax during streaming and emits tool call chunk on close", async () => {
      statMock.mockResolvedValue({ isDirectory: () => true });
      readdirMock.mockResolvedValue([
        { name: "model1.llamafile", isFile: () => true },
      ]);
      accessMock.mockResolvedValue(undefined);

      const service = await getService();

      const fakeChild: any = new EventEmitter();
      fakeChild.pid = 1234;
      fakeChild.stdout = new EventEmitter();
      fakeChild.stderr = new EventEmitter();
      fakeChild.exitCode = null;
      fakeChild.signalCode = null;
      fakeChild.killed = false;

      spawnMock.mockImplementation(() => {
        queueMicrotask(() => fakeChild.emit("spawn"));
        return fakeChild;
      });

      const mockReq: any = new EventEmitter();
      mockReq.headers = {};
      mockReq.socket = new EventEmitter();

      const writtenChunks: string[] = [];
      const res = Object.assign(new EventEmitter(), {
        statusCode: 200,
        headersSent: true,
        writableEnded: false,
        write: jest.fn((chunk: any) => {
          writtenChunks.push(String(chunk));
        }),
        end: jest.fn(() => {
          res.writableEnded = true;
        }),
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        flushHeaders: jest.fn(),
      }) as any;

      const invokePromise = service.invokeCli(
        mockReq,
        res,
        {
          model: "model1",
          messages: [{ role: "user", content: "read a file" }],
          tools: [{ name: "read_file", description: "read file" }],
          stream: true,
        },
        { model: "model1", offline: false },
        false,
      );

      setImmediate(() => {
        fakeChild.stdout.emit(
          "data",
          Buffer.from('call:read_file{path:"test.txt"}'),
        );
        fakeChild.emit("close", 0);
      });

      await invokePromise;

      // Ensure raw "call:read_file" did NOT leak as a text delta chunk
      const deltaContentChunks = writtenChunks.filter(
        (c) => c.includes('"delta":{"content":') && c.includes("read_file"),
      );
      expect(deltaContentChunks).toHaveLength(0);

      // Ensure tool call chunk was emitted
      const toolCallChunks = writtenChunks.filter((c) =>
        c.includes('"tool_calls":'),
      );
      expect(toolCallChunks.length).toBeGreaterThanOrEqual(1);
      expect(toolCallChunks[0]).toContain('"name":"read_file"');
      expect(toolCallChunks[0]).toContain('\\"path\\":\\"test.txt\\"');

      // Ensure finish_reason: tool_calls was emitted
      const doneChunk = writtenChunks.find((c) =>
        c.includes('"finish_reason":"tool_calls"'),
      );
      expect(doneChunk).toBeDefined();
    });
  });

  describe("Agentfile Driver & Execution Support", () => {
    it("builds expected agentfile CLI flags with defaults and custom options", async () => {
      const { getBinaryDriver } = await import("./llamafile-manager.js");
      const agentDriver = getBinaryDriver("agentfile");
      expect(agentDriver).toBeDefined();
      expect(typeof agentDriver?.buildArgs).toBe("function");

      // Default flags
      const defaultArgs = agentDriver!.buildArgs!({
        prompt: "Summarize readme",
        nPredict: 512,
        ctxSize: 65536,
      });

      expect(defaultArgs).toContain("-p");
      expect(defaultArgs).toContain("Summarize readme");
      expect(defaultArgs).toContain("-c");
      expect(defaultArgs).toContain("65536");
      expect(defaultArgs).toContain("--yes");
      expect(defaultArgs).toContain("--tools");
      expect(defaultArgs).toContain("all");

      // Custom tool list and sandbox flags
      const customArgs = agentDriver!.buildArgs!({
        prompt: "Test query",
        nPredict: 256,
        ctxSize: 32768,
        tools: [{ name: "read_file" }, { name: "grep_search" }],
        runtimeOptions: {
          systemPrompt: "You are an agent",
          toolsRuntime: "docker:sandbox-img",
          searxngUrl: "http://localhost:8888",
          sessionFile: "/tmp/session.jsonl",
          traceFile: "/tmp/trace.jsonl",
          maxIterations: 12,
          think: true,
          confirm: true,
        },
      });

      expect(customArgs).toContain("-s");
      expect(customArgs).toContain("You are an agent");
      expect(customArgs).toContain("--tools");
      expect(customArgs).toContain("read_file,grep_search");
      expect(customArgs).toContain("--tools-runtime");
      expect(customArgs).toContain("docker:sandbox-img");
      expect(customArgs).toContain("--searxng-url");
      expect(customArgs).toContain("http://localhost:8888");
      expect(customArgs).toContain("--session");
      expect(customArgs).toContain("/tmp/session.jsonl");
      expect(customArgs).toContain("--trace");
      expect(customArgs).toContain("/tmp/trace.jsonl");
      expect(customArgs).toContain("--max-iterations");
      expect(customArgs).toContain("12");
      expect(customArgs).toContain("--think");
      expect(customArgs).toContain("--confirm");
      expect(customArgs).not.toContain("--yes");

      // Explicit no tools
      const noToolsArgs = agentDriver!.buildArgs!({
        prompt: "Hello",
        nPredict: 100,
        ctxSize: 4096,
        tools: [],
      });
      expect(noToolsArgs).toContain("--tools");
      expect(noToolsArgs).toContain("none");
    });

    it("executes agentfile binary in non-streaming mode (stdout answer, stderr tool activity)", async () => {
      statMock.mockResolvedValue({ isDirectory: () => true });
      readdirMock.mockResolvedValue([
        { name: "test-agent.agentfile", isFile: () => true },
      ]);
      accessMock.mockResolvedValue(undefined);

      const service = await getService();

      const fakeChild: any = new EventEmitter();
      fakeChild.pid = 5678;
      fakeChild.stdout = new EventEmitter();
      fakeChild.stderr = new EventEmitter();
      fakeChild.exitCode = null;
      fakeChild.signalCode = null;
      fakeChild.killed = false;

      spawnMock.mockImplementation(() => {
        queueMicrotask(() => fakeChild.emit("spawn"));
        return fakeChild;
      });

      const mockReq: any = new EventEmitter();
      mockReq.headers = {};
      mockReq.socket = new EventEmitter();

      const res = Object.assign(new EventEmitter(), {
        statusCode: 200,
        body: undefined as any,
        json: jest.fn((val: any) => {
          res.body = val;
        }),
        status: jest.fn().mockReturnThis(),
      }) as any;

      const invokePromise = service.invokeCli(
        mockReq,
        res,
        {
          model: "test-agent.agentfile",
          messages: [{ role: "user", content: "What is in this folder?" }],
          tools_runtime: "docker:my-container",
          searxng_url: "http://searxng:8080",
          max_iterations: 5,
        },
        { model: "test-agent.agentfile", offline: false },
        false,
      );

      // Simulate stderr tool execution log and stdout final answer
      setImmediate(() => {
        fakeChild.stderr.emit(
          "data",
          Buffer.from("[tool: read_file] reading dir\n"),
        );
        fakeChild.stdout.emit(
          "data",
          Buffer.from("Here is what is in the folder: package.json, README.md"),
        );
        fakeChild.emit("close", 0);
      });

      await invokePromise;

      // Verify spawned flags contain agentfile parameters
      expect(spawnMock).toHaveBeenCalled();
      const spawnedArgs =
        spawnMock.mock.calls[spawnMock.mock.calls.length - 1][1];
      expect(spawnedArgs).toContain("--tools-runtime");
      expect(spawnedArgs).toContain("docker:my-container");
      expect(spawnedArgs).toContain("--searxng-url");
      expect(spawnedArgs).toContain("http://searxng:8080");
      expect(spawnedArgs).toContain("--max-iterations");
      expect(spawnedArgs).toContain("5");
      expect(spawnedArgs).toContain("--yes");

      expect(res.json).toHaveBeenCalled();
      expect(res.body.choices[0].message.content).toBe(
        "Here is what is in the folder: package.json, README.md",
      );
      expect(res.body.choices[0].finish_reason).toBe("stop");
    });

    it("executes agentfile binary in streaming mode, emitting deltas from stdout", async () => {
      statMock.mockResolvedValue({ isDirectory: () => true });
      readdirMock.mockResolvedValue([
        { name: "test-agent.agentfile", isFile: () => true },
      ]);
      accessMock.mockResolvedValue(undefined);

      const service = await getService();

      const fakeChild: any = new EventEmitter();
      fakeChild.pid = 9012;
      fakeChild.stdout = new EventEmitter();
      fakeChild.stderr = new EventEmitter();
      fakeChild.exitCode = null;
      fakeChild.signalCode = null;
      fakeChild.killed = false;

      spawnMock.mockImplementation(() => {
        queueMicrotask(() => fakeChild.emit("spawn"));
        return fakeChild;
      });

      const mockReq: any = new EventEmitter();
      mockReq.headers = {};
      mockReq.socket = new EventEmitter();

      const writtenChunks: string[] = [];
      const res = Object.assign(new EventEmitter(), {
        statusCode: 200,
        headersSent: true,
        writableEnded: false,
        write: jest.fn((chunk: any) => {
          writtenChunks.push(String(chunk));
        }),
        end: jest.fn(() => {
          res.writableEnded = true;
        }),
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        flushHeaders: jest.fn(),
      }) as any;

      const invokePromise = service.invokeCli(
        mockReq,
        res,
        {
          model: "test-agent.agentfile",
          messages: [{ role: "user", content: "Explain git" }],
          stream: true,
        },
        { model: "test-agent.agentfile", offline: false },
        false,
      );

      setImmediate(() => {
        fakeChild.stderr.emit(
          "data",
          Buffer.from("[tool: exec_shell_command] git status\n"),
        );
        fakeChild.stdout.emit(
          "data",
          Buffer.from("Git is a version control system."),
        );
        fakeChild.emit("close", 0);
      });

      await invokePromise;

      const textChunks = writtenChunks.filter((c) =>
        c.includes('"delta":{"content":"Git is a version control system."}'),
      );
      expect(textChunks.length).toBeGreaterThanOrEqual(1);

      const doneChunk = writtenChunks.find((c) => c.includes("[DONE]"));
      expect(doneChunk).toBeDefined();
    });

    it("handles agentfile exit code 4 (iteration cap reached)", async () => {
      statMock.mockResolvedValue({ isDirectory: () => true });
      readdirMock.mockResolvedValue([
        { name: "test-agent.agentfile", isFile: () => true },
      ]);
      accessMock.mockResolvedValue(undefined);

      const service = await getService();

      const fakeChild: any = new EventEmitter();
      fakeChild.pid = 9013;
      fakeChild.stdout = new EventEmitter();
      fakeChild.stderr = new EventEmitter();
      fakeChild.exitCode = null;
      fakeChild.signalCode = null;
      fakeChild.killed = false;

      spawnMock.mockImplementation(() => {
        queueMicrotask(() => fakeChild.emit("spawn"));
        return fakeChild;
      });

      const mockReq: any = new EventEmitter();
      mockReq.headers = {};
      mockReq.socket = new EventEmitter();

      const res = Object.assign(new EventEmitter(), {
        statusCode: 200,
        body: undefined as any,
        json: jest.fn((val: any) => {
          res.body = val;
        }),
        status: jest.fn().mockReturnThis(),
      }) as any;

      const invokePromise = service.invokeCli(
        mockReq,
        res,
        {
          model: "test-agent.agentfile",
          messages: [{ role: "user", content: "Long task" }],
        },
        { model: "test-agent.agentfile", offline: false },
        false,
      );

      setImmediate(() => {
        fakeChild.stdout.emit("data", Buffer.from("Partial result before cap"));
        fakeChild.emit("close", 4);
      });

      await invokePromise;

      expect(res.json).toHaveBeenCalled();
      expect(res.body.choices[0].message.content).toBe(
        "Partial result before cap",
      );
      expect(res.body.choices[0].finish_reason).toBe("length");
    });

    it("handles invokeCli streaming with tool calls", async () => {
      statMock.mockResolvedValue({ isDirectory: () => true });
      readdirMock.mockResolvedValue([
        { name: "model1.llamafile", isFile: () => true },
      ]);
      accessMock.mockResolvedValue(undefined);

      const service = await getService();

      const fakeChild: any = new EventEmitter();
      fakeChild.pid = 1234;
      fakeChild.stdout = new EventEmitter();
      fakeChild.stderr = new EventEmitter();
      fakeChild.exitCode = null;
      fakeChild.signalCode = null;
      fakeChild.killed = false;

      spawnMock.mockImplementation(() => {
        queueMicrotask(() => fakeChild.emit("spawn"));
        return fakeChild;
      });

      const mockReq: any = new EventEmitter();
      mockReq.headers = {};
      mockReq.socket = new EventEmitter();

      const writtenChunks: string[] = [];
      const res = Object.assign(new EventEmitter(), {
        statusCode: 200,
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        write: jest.fn((chunk: string) => {
          writtenChunks.push(chunk);
          res.headersSent = true;
        }),
        end: jest.fn(),
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
      }) as any;

      const invokePromise = service.invokeCli(
        mockReq,
        res,
        {
          model: "model1",
          messages: [{ role: "user", content: "call tool" }],
          stream: true,
        },
        { model: "model1", offline: false },
        false,
      );

      setImmediate(() => {
        fakeChild.stdout.emit(
          "data",
          Buffer.from('call:read_file{path:"test.txt"}'),
        );
        fakeChild.emit("close", 0);
      });

      await invokePromise;

      expect(res.write).toHaveBeenCalled();
      expect(res.end).toHaveBeenCalled();
      const fullWritten = writtenChunks.join("");
      expect(fullWritten).toContain("read_file");
      expect(fullWritten).toContain('"finish_reason":"tool_calls"');
    });

    it("handles invokeCli streaming process failure on close", async () => {
      statMock.mockResolvedValue({ isDirectory: () => true });
      readdirMock.mockResolvedValue([
        { name: "model1.llamafile", isFile: () => true },
      ]);
      accessMock.mockResolvedValue(undefined);

      const service = await getService();

      const fakeChild: any = new EventEmitter();
      fakeChild.pid = 1234;
      fakeChild.stdout = new EventEmitter();
      fakeChild.stderr = new EventEmitter();
      fakeChild.exitCode = null;
      fakeChild.signalCode = null;
      fakeChild.killed = false;

      spawnMock.mockImplementation(() => {
        queueMicrotask(() => fakeChild.emit("spawn"));
        return fakeChild;
      });

      const mockReq: any = new EventEmitter();
      mockReq.headers = {};
      mockReq.socket = new EventEmitter();

      const writtenChunks: string[] = [];
      const res = Object.assign(new EventEmitter(), {
        statusCode: 200,
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        write: jest.fn((chunk: string) => {
          writtenChunks.push(chunk);
          res.headersSent = true;
        }),
        end: jest.fn(),
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
      }) as any;

      const invokePromise = service.invokeCli(
        mockReq,
        res,
        {
          model: "model1",
          messages: [{ role: "user", content: "crash" }],
          stream: true,
        },
        { model: "model1", offline: false },
        false,
      );

      setImmediate(() => {
        fakeChild.stderr.emit("data", Buffer.from("Fatal llamafile segfault"));
        fakeChild.emit("close", 1);
      });

      await invokePromise;

      expect(res.write).toHaveBeenCalled();
      expect(res.end).toHaveBeenCalled();
      const fullWritten = writtenChunks.join("");
      expect(fullWritten).toContain("Fatal llamafile segfault");
      expect(fullWritten).toContain("[DONE]");
    });

    it("handles invokeCli non-streaming failure on non-zero exit code", async () => {
      statMock.mockResolvedValue({ isDirectory: () => true });
      readdirMock.mockResolvedValue([
        { name: "model1.llamafile", isFile: () => true },
      ]);
      accessMock.mockResolvedValue(undefined);

      const service = await getService();

      const fakeChild: any = new EventEmitter();
      fakeChild.pid = 1234;
      fakeChild.stdout = new EventEmitter();
      fakeChild.stderr = new EventEmitter();
      fakeChild.exitCode = null;
      fakeChild.signalCode = null;
      fakeChild.killed = false;

      spawnMock.mockImplementation(() => {
        queueMicrotask(() => fakeChild.emit("spawn"));
        return fakeChild;
      });

      const mockReq: any = new EventEmitter();
      mockReq.headers = {};
      mockReq.socket = new EventEmitter();

      const res = Object.assign(new EventEmitter(), {
        statusCode: 200,
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }) as any;

      const invokePromise = service.invokeCli(
        mockReq,
        res,
        {
          model: "model1",
          messages: [{ role: "user", content: "fail" }],
        },
        { model: "model1", offline: false },
        false,
      );

      setImmediate(() => {
        fakeChild.stderr.emit("data", Buffer.from("Out of memory"));
        fakeChild.emit("close", 1);
      });

      await invokePromise;

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Out of memory" });
    });

    it("handles invokeCli child process error", async () => {
      statMock.mockResolvedValue({ isDirectory: () => true });
      readdirMock.mockResolvedValue([
        { name: "model1.llamafile", isFile: () => true },
      ]);
      accessMock.mockResolvedValue(undefined);

      const service = await getService();

      const fakeChild: any = new EventEmitter();
      fakeChild.pid = 1234;
      fakeChild.stdout = new EventEmitter();
      fakeChild.stderr = new EventEmitter();
      fakeChild.exitCode = null;
      fakeChild.signalCode = null;
      fakeChild.killed = false;

      spawnMock.mockImplementation(() => {
        queueMicrotask(() => fakeChild.emit("spawn"));
        return fakeChild;
      });

      const mockReq: any = new EventEmitter();
      mockReq.headers = {};
      mockReq.socket = new EventEmitter();

      const res = Object.assign(new EventEmitter(), {
        statusCode: 200,
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }) as any;

      const invokePromise = service.invokeCli(
        mockReq,
        res,
        {
          model: "model1",
          messages: [{ role: "user", content: "spawn fail" }],
        },
        { model: "model1", offline: false },
        false,
      );

      setImmediate(() => {
        fakeChild.emit("error", new Error("EACCES permission denied"));
      });

      await invokePromise;

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("EACCES permission denied"),
        }),
      );
    });

    it("probes --offline support flag when offline option is true", async () => {
      statMock.mockResolvedValue({ isDirectory: () => true });
      readdirMock.mockResolvedValue([
        { name: "model1.llamafile", isFile: () => true },
      ]);
      accessMock.mockResolvedValue(undefined);

      const service = await getService();

      let callCount = 0;
      spawnMock.mockImplementation((_cmd: string, args: string[]) => {
        const child: any = new EventEmitter();
        child.pid = 5000 + callCount++;
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.exitCode = null;
        child.signalCode = null;
        child.killed = false;

        queueMicrotask(() => {
          child.emit("spawn");
          setImmediate(() => {
            if (args && args.includes("--help")) {
              child.stdout.emit(
                "data",
                Buffer.from("Options:\n  --offline   Do not connect\n"),
              );
              child.emit("close", 0);
            } else {
              child.stdout.emit("data", Buffer.from("Answer offline"));
              child.emit("close", 0);
            }
          });
        });

        return child;
      });

      const mockReq: any = new EventEmitter();
      mockReq.headers = {};
      mockReq.socket = new EventEmitter();

      const res = Object.assign(new EventEmitter(), {
        statusCode: 200,
        body: undefined as any,
        json: jest.fn((val: any) => {
          res.body = val;
        }),
        status: jest.fn().mockReturnThis(),
      }) as any;

      await service.invokeCli(
        mockReq,
        res,
        {
          model: "model1",
          messages: [{ role: "user", content: "hello" }],
        },
        { model: "model1", offline: true },
        true,
      );

      expect(res.json).toHaveBeenCalled();
      expect(service.__getOfflineSupportCache().size).toBeGreaterThan(0);
    });
  });
});
