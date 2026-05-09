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

  describe("listBinaries", () => {
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
    });

    it("throws error if no cache directory is found", async () => {
      statMock.mockRejectedValue(new Error("Not found"));

      const service = await getService();
      await expect(service.listBinaries()).rejects.toThrow(
        /Could not locate assets\/cache\/llamafile directory/,
      );
    });
  });

  describe("getLlamafileRuntimeOptions", () => {
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
  });

  describe("createLlamafilePromptEchoFilter", () => {
    it("strips echoed prompt from output", async () => {
      const { createLlamafilePromptEchoFilter } =
        await import("./llamafile-manager.js");
      const prompt = "USER: hello\n\nASSISTANT:";
      const filter = createLlamafilePromptEchoFilter(prompt);

      expect(filter.push(prompt)).toBe("");
      expect(filter.push(" Hello there!")).toBe(" Hello there!");
      expect(filter.flush()).toBe("");
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

      // Mock listBinaries/resolveBinary
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

      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for spawn

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
  });
});
