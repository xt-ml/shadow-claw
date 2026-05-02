import { jest } from "@jest/globals";
import { EventEmitter } from "node:events";

describe("Transformers.js proxy runtime safety", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    process.env.TRANSFORMERS_JS_REQUEST_TIMEOUT_MS = "25";
  });

  afterEach(async () => {
    try {
      const mod = await import("./proxy.js");
      await mod.__resetTransformersJsRuntimeForTests();
    } catch {
      // Ignore cleanup errors when the module never loaded.
    }

    delete process.env.TRANSFORMERS_JS_REQUEST_TIMEOUT_MS;
    jest.useRealTimers();
  });

  it("times out stalled local generation and evicts the runtime", async () => {
    const mod = await import("./proxy.js");

    const disposeModel = (jest.fn() as any).mockResolvedValue(undefined);
    const disposeProcessor = (jest.fn() as any).mockResolvedValue(undefined);

    const processor: any = Object.assign(
      jest.fn(async () => ({
        input_ids: {
          dims: [1, 4],
        },
      })),
      {
        apply_chat_template: jest.fn(() => "user: What is the weather?"),
        tokenizer: {},
        batch_decode: jest.fn(() => ["decoded fallback"]),
        dispose: disposeProcessor,
      },
    );

    const generate = jest.fn(({ signal }: { signal?: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        );
      });
    });

    class MockTextStreamer {
      constructor(_tokenizer: unknown, _opts: unknown) {}
    }

    mod.__setTransformersJsRuntimeForTests("test-model", {
      processor,
      model: {
        generate,
        dispose: disposeModel,
      },
      TextStreamer: MockTextStreamer,
      modelLoaderName: "mock-loader",
    });

    const pending = mod.runTransformersJsChatCompletion({
      modelId: "test-model",
      messages: [{ role: "user", content: "What is the weather?" }],
      maxCompletionTokens: 32,
      verbose: false,
    });

    const timeoutExpectation = expect(pending).rejects.toThrow(
      "Transformers.js generation timed out after 25ms for model 'test-model'.",
    );

    await jest.advanceTimersByTimeAsync(30);

    await timeoutExpectation;

    expect(generate).toHaveBeenCalledTimes(1);
    expect(disposeModel).toHaveBeenCalledTimes(1);
    expect(disposeProcessor).toHaveBeenCalledTimes(1);
  });

  it("writes an SSE error instead of json after streaming headers were sent", async () => {
    const mod = await import("./proxy.js");

    const res = {
      headersSent: true,
      writableEnded: false,
      write: jest.fn(),
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    mod.sendStreamingProxyError(res, {
      status: 500,
      publicMessage: "Transformers.js invocation failed: network error",
      streamMessage: "network error",
    });

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('"message":"network error"'),
    );
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});

describe("Llamafile proxy cancellation", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("cancels an active CLI llamafile process by request id", async () => {
    const spawnMock = jest.fn();
    const statMock = jest.fn(async () => ({ isDirectory: () => true }));
    const readdirMock = jest.fn(async () => [
      {
        name: "tiny.llamafile",
        isFile: () => true,
      },
    ]);
    const accessMock = jest.fn(async () => undefined);

    jest.unstable_mockModule("node:child_process", () => ({
      spawn: spawnMock,
    }));
    jest.unstable_mockModule("node:fs/promises", () => ({
      readdir: readdirMock,
      stat: statMock,
      access: accessMock,
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      unlink: jest.fn(),
    }));

    const processKillMock = jest
      .spyOn(process, "kill")
      .mockImplementation(() => true);

    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      pid: number;
      exitCode: number | null;
      signalCode: NodeJS.Signals | null;
      killed: boolean;
      kill: jest.Mock;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.pid = 4321;
    child.exitCode = null;
    child.signalCode = null;
    child.killed = false;
    child.kill = jest.fn();

    spawnMock.mockReturnValue(child);

    const mod = await import("./proxy.js");
    const routes = new Map<string, any>();
    const app = {
      get: jest.fn((path: string, handler: any) => {
        routes.set(`GET ${path}`, handler);
      }),
      post: jest.fn((path: string, handler: any) => {
        routes.set(`POST ${path}`, handler);
      }),
      all: jest.fn(),
    } as any;

    mod.registerProxyRoutes(app, { verbose: false });

    const invokeHandler = routes.get("POST /llamafile-proxy/chat/completions");
    const cancelHandler = routes.get("POST /llamafile-proxy/cancel");

    const invokeReq = Object.assign(new EventEmitter(), {
      body: { model: "tiny" },
      headers: {
        "x-llamafile-mode": "cli",
        "x-shadowclaw-request-id": "req-1",
      },
      socket: new EventEmitter(),
    });
    const invokeRes = Object.assign(new EventEmitter(), {
      headersSent: false,
      writableEnded: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(function (this: { writableEnded: boolean }) {
        this.writableEnded = true;
      }),
      send: jest.fn(),
    });

    const invokePromise = invokeHandler(invokeReq, invokeRes);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(spawnMock).toHaveBeenCalled();

    const cancelReq = Object.assign(new EventEmitter(), {
      body: { requestId: "req-1" },
      headers: {},
      socket: new EventEmitter(),
    });
    const cancelRes = Object.assign(new EventEmitter(), {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    });

    cancelHandler(cancelReq, cancelRes);

    expect(cancelRes.status).toHaveBeenCalledWith(202);
    expect(cancelRes.json).toHaveBeenCalledWith({ ok: true, cancelled: true });
    expect(processKillMock).toHaveBeenCalledWith(-4321, "SIGTERM");

    child.signalCode = "SIGTERM";
    child.emit("close", null);
    await invokePromise;

    processKillMock.mockRestore();
  });
});
