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

  it("times out stalled local generation without disposing shared runtime", async () => {
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

    const modelId = "onnx-community/gemma-4-E2B-it-ONNX";
    mod.__setTransformersJsRuntimeForTests(modelId, {
      processor,
      model: {
        generate,
        dispose: disposeModel,
      },
      TextStreamer: MockTextStreamer,
      modelLoaderName: "mock-loader",
    });

    const pending = mod.runTransformersJsChatCompletion({
      modelId,
      messages: [{ role: "user", content: "What is the weather?" }],
      maxCompletionTokens: 32,
      verbose: false,
    });

    const timeoutExpectation = expect(pending).rejects.toThrow(
      `Transformers.js generation timed out after 25ms for model '${modelId}'.`,
    );

    await jest.advanceTimersByTimeAsync(30);

    await timeoutExpectation;

    expect(generate).toHaveBeenCalledTimes(1);
    expect(disposeModel).not.toHaveBeenCalled();
    expect(disposeProcessor).not.toHaveBeenCalled();
  });

  it("keeps model load alive while progress increases", async () => {
    jest.unstable_mockModule("@huggingface/transformers", () => ({
      env: {},
      AutoProcessor: {
        from_pretrained: jest.fn(
          () => new Promise((_resolve) => undefined as never),
        ),
      },
      Gemma4Processor: {
        from_pretrained: jest.fn(
          () => new Promise((_resolve) => undefined as never),
        ),
      },
      Gemma4ForConditionalGeneration: {
        from_pretrained: jest.fn(
          () => new Promise((_resolve) => undefined as never),
        ),
      },
      AutoModelForImageTextToText: {
        from_pretrained: jest.fn(),
      },
      AutoModelForCausalLM: {
        from_pretrained: jest.fn(),
      },
      TextStreamer: class MockTextStreamer {},
    }));

    const mod = await import("./proxy.js");

    const modelId = "onnx-community/gemma-4-E2B-it-ONNX";
    const pending = mod.runTransformersJsChatCompletion({
      modelId,
      messages: [{ role: "user", content: "hello" }],
      maxCompletionTokens: 32,
      verbose: false,
    });

    // Let model-load startup initialize download status before we simulate
    // additional monotonic progress.
    await Promise.resolve();

    // Confirm the request survives multiple near-timeout windows as long as
    // progress keeps increasing.
    for (let i = 1; i <= 5; i++) {
      await jest.advanceTimersByTimeAsync(20);

      mod.__setTransformersJsDownloadStatusForTests({
        status: "running",
        modelId,
        progress: i / 10,
        message: "Downloading...",
      });
    }

    const timeoutExpectation = expect(pending).rejects.toThrow(
      `Transformers.js model load timed out after 25ms for model '${modelId}'.`,
    );

    await jest.advanceTimersByTimeAsync(60);
    await timeoutExpectation;
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

  it("rejects unsupported models with helpful error listing supported ONNX models", async () => {
    const mod = await import("./proxy.js");

    const unsupported = mod.runTransformersJsChatCompletion({
      modelId: "google/gemma-4-26B-A4B-it",
      messages: [{ role: "user", content: "hello" }],
      maxCompletionTokens: 32,
      verbose: false,
    });

    const errorExpectation = expect(unsupported).rejects.toThrow(
      /not supported by Transformers\.js.*ONNX.*supported models:/i,
    );

    await errorExpectation;
  });
});

describe("Transformers.js tool-call normalization", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(async () => {
    try {
      const mod = await import("./proxy.js");
      await mod.__resetTransformersJsRuntimeForTests();
    } catch {
      // Ignore cleanup errors when the module never loaded.
    }
  });

  it("normalizes non-stream call: output into OpenAI tool_calls", async () => {
    const mod = await import("./proxy.js");

    class MockTextStreamer {
      opts: any;

      constructor(_tokenizer: unknown, opts: unknown) {
        this.opts = opts;
      }
    }

    const processor: any = Object.assign(
      jest.fn(async () => ({
        input_ids: {
          dims: [1, 4],
        },
      })),
      {
        apply_chat_template: jest.fn(() => "user: Update memory"),
        tokenizer: {},
        batch_decode: jest.fn(() => [""]),
      },
    );

    const generate = jest.fn(async ({ streamer }: { streamer: any }) => {
      streamer?.opts?.callback_function?.(
        "call:update_memory{content:'Today is 2026-05-05.'}",
      );

      return [];
    });

    const modelId = "onnx-community/gemma-4-E4B-it-ONNX";
    mod.__setTransformersJsRuntimeForTests(modelId, {
      processor,
      model: {
        generate,
        dispose: jest.fn(),
      },
      TextStreamer: MockTextStreamer,
      modelLoaderName: "mock-loader",
    });

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
    const handler = routes.get("POST /transformers-js-proxy/chat/completions");

    const req = Object.assign(new EventEmitter(), {
      body: {
        model: modelId,
        stream: false,
        messages: [{ role: "user", content: "please update memory" }],
      },
      headers: {},
    }) as any;

    const res = Object.assign(new EventEmitter(), {
      headersSent: false,
      writableEnded: false,
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }) as any;

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: [
          expect.objectContaining({
            finish_reason: "tool_calls",
            message: expect.objectContaining({
              content: null,
              tool_calls: [
                expect.objectContaining({
                  type: "function",
                  function: expect.objectContaining({
                    name: "update_memory",
                  }),
                }),
              ],
            }),
          }),
        ],
      }),
    );
  });

  it("normalizes non-stream <execute_tool> output into OpenAI tool_calls", async () => {
    const mod = await import("./proxy.js");

    class MockTextStreamer {
      opts: any;

      constructor(_tokenizer: unknown, opts: unknown) {
        this.opts = opts;
      }
    }

    const processor: any = Object.assign(
      jest.fn(async () => ({
        input_ids: {
          dims: [1, 4],
        },
      })),
      {
        apply_chat_template: jest.fn(() => "user: Update memory"),
        tokenizer: {},
        batch_decode: jest.fn(() => [""]),
      },
    );

    const generate = jest.fn(async ({ streamer }: { streamer: any }) => {
      streamer?.opts?.callback_function?.(
        '<execute_tool> update_memory(content="Today\'s date is 2026-05-05.") </execute_tool>',
      );

      return [];
    });

    const modelId = "onnx-community/gemma-4-E4B-it-ONNX";
    mod.__setTransformersJsRuntimeForTests(modelId, {
      processor,
      model: {
        generate,
        dispose: jest.fn(),
      },
      TextStreamer: MockTextStreamer,
      modelLoaderName: "mock-loader",
    });

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
    const handler = routes.get("POST /transformers-js-proxy/chat/completions");

    const req = Object.assign(new EventEmitter(), {
      body: {
        model: modelId,
        stream: false,
        messages: [{ role: "user", content: "please update memory" }],
      },
      headers: {},
    }) as any;

    const res = Object.assign(new EventEmitter(), {
      headersSent: false,
      writableEnded: false,
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }) as any;

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: [
          expect.objectContaining({
            finish_reason: "tool_calls",
            message: expect.objectContaining({
              content: null,
              tool_calls: [
                expect.objectContaining({
                  type: "function",
                  function: expect.objectContaining({
                    name: "update_memory",
                    arguments: JSON.stringify({
                      content: "Today's date is 2026-05-05.",
                    }),
                  }),
                }),
              ],
            }),
          }),
        ],
      }),
    );
  });

  it("normalizes stream call: output into tool_calls SSE", async () => {
    const mod = await import("./proxy.js");

    class MockTextStreamer {
      opts: any;

      constructor(_tokenizer: unknown, opts: unknown) {
        this.opts = opts;
      }
    }

    const processor: any = Object.assign(
      jest.fn(async () => ({
        input_ids: {
          dims: [1, 4],
        },
      })),
      {
        apply_chat_template: jest.fn(() => "user: Update memory"),
        tokenizer: {},
        batch_decode: jest.fn(() => [""]),
      },
    );

    const generate = jest.fn(async ({ streamer }: { streamer: any }) => {
      streamer?.opts?.callback_function?.(
        "call:update_memory{content:'Today is 2026-05-05.'}",
      );

      return [];
    });

    const modelId = "onnx-community/gemma-4-E4B-it-ONNX";
    mod.__setTransformersJsRuntimeForTests(modelId, {
      processor,
      model: {
        generate,
        dispose: jest.fn(),
      },
      TextStreamer: MockTextStreamer,
      modelLoaderName: "mock-loader",
    });

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
    const handler = routes.get("POST /transformers-js-proxy/chat/completions");

    const req = Object.assign(new EventEmitter(), {
      body: {
        model: modelId,
        stream: true,
        messages: [{ role: "user", content: "please update memory" }],
      },
      headers: {},
    }) as any;

    const res = Object.assign(new EventEmitter(), {
      headersSent: false,
      writableEnded: false,
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }) as any;

    await handler(req, res);

    const writes = res.write.mock.calls.map((call: any[]) => String(call[0]));
    const allOutput = writes.join("\n");

    expect(allOutput).toContain('"tool_calls"');
    expect(allOutput).toContain('"name":"update_memory"');
    expect(allOutput).toContain('"finish_reason":"tool_calls"');
    expect(allOutput).toContain("data: [DONE]");
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it("normalizes stream <execute_tool> output into tool_calls SSE", async () => {
    const mod = await import("./proxy.js");

    class MockTextStreamer {
      opts: any;

      constructor(_tokenizer: unknown, opts: unknown) {
        this.opts = opts;
      }
    }

    const processor: any = Object.assign(
      jest.fn(async () => ({
        input_ids: {
          dims: [1, 4],
        },
      })),
      {
        apply_chat_template: jest.fn(() => "user: Update memory"),
        tokenizer: {},
        batch_decode: jest.fn(() => [""]),
      },
    );

    const generate = jest.fn(async ({ streamer }: { streamer: any }) => {
      streamer?.opts?.callback_function?.(
        '<execute_tool> update_memory(content="Today\'s date is 2026-05-05.") </execute_tool>',
      );

      return [];
    });

    const modelId = "onnx-community/gemma-4-E4B-it-ONNX";
    mod.__setTransformersJsRuntimeForTests(modelId, {
      processor,
      model: {
        generate,
        dispose: jest.fn(),
      },
      TextStreamer: MockTextStreamer,
      modelLoaderName: "mock-loader",
    });

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
    const handler = routes.get("POST /transformers-js-proxy/chat/completions");

    const req = Object.assign(new EventEmitter(), {
      body: {
        model: modelId,
        stream: true,
        messages: [{ role: "user", content: "please update memory" }],
      },
      headers: {},
    }) as any;

    const res = Object.assign(new EventEmitter(), {
      headersSent: false,
      writableEnded: false,
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }) as any;

    await handler(req, res);

    const writes = res.write.mock.calls.map((call: any[]) => String(call[0]));
    const allOutput = writes.join("\n");

    expect(allOutput).toContain('"tool_calls"');
    expect(allOutput).toContain('"name":"update_memory"');
    expect(allOutput).toContain(
      '"arguments":"{\\"content\\":\\"Today\'s date is 2026-05-05.\\"}"',
    );
    expect(allOutput).toContain('"finish_reason":"tool_calls"');
    expect(allOutput).toContain("data: [DONE]");
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

    spawnMock.mockImplementation(() => {
      queueMicrotask(() => child.emit("spawn"));

      return child;
    });

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
      body: {
        model: "tiny",
        messages: [{ role: "user", content: "hello" }],
      },
      headers: {
        "x-llamafile-mode": "cli",
        "x-llamafile-offline": "false",
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

describe("Llamafile prompt echo stripping", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("removes echoed SYSTEM/USER scaffold from non-streaming output", async () => {
    const mod = await import("./proxy.js");
    const prompt = [
      "SYSTEM: You are k9.",
      "",
      "USER: What tools do you have access to?",
      "",
      "ASSISTANT:",
    ].join("\n");

    const raw = `${prompt}\nI have no tools currently enabled.`;
    const cleaned = mod.stripLlamafilePromptEcho(raw, prompt);

    expect(cleaned).toBe("I have no tools currently enabled.");
  });

  it("leaves normal non-echo responses unchanged", async () => {
    const mod = await import("./proxy.js");
    const prompt = "SYSTEM: You are k9.\n\nUSER: hello\n\nASSISTANT:";
    const raw = "I can help with that.";

    const cleaned = mod.stripLlamafilePromptEcho(raw, prompt);

    expect(cleaned).toBe("I can help with that.");
  });
});

describe("Llamafile CLI tool-call normalization", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function makeCliChild(stdoutText: string) {
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
    child.pid = 9876;
    child.exitCode = null;
    child.signalCode = null;
    child.killed = false;
    child.kill = jest.fn();

    queueMicrotask(() => {
      child.emit("spawn");
      setTimeout(() => {
        child.stdout.emit("data", Buffer.from(stdoutText, "utf8"));
        child.emit("close", 0);
      }, 0);
    });

    return child;
  }

  it("normalizes non-stream CLI execute_tool text into OpenAI tool_calls", async () => {
    const spawnMock = jest
      .fn()
      .mockImplementation(() =>
        makeCliChild(
          '<execute_tool> update_memory(content="Today\'s date is 2026-05-06.") </execute_tool>',
        ),
      );

    jest.unstable_mockModule("node:child_process", () => ({
      spawn: spawnMock,
    }));
    jest.unstable_mockModule("node:fs/promises", () => ({
      readdir: jest.fn(async () => [
        {
          name: "tiny.llamafile",
          isFile: () => true,
        },
      ]),
      stat: jest.fn(async () => ({ isDirectory: () => true })),
      access: jest.fn(async () => undefined),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      unlink: jest.fn(),
    }));

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
    const handler = routes.get("POST /llamafile-proxy/chat/completions");

    const req = Object.assign(new EventEmitter(), {
      body: {
        model: "tiny",
        stream: false,
        messages: [{ role: "user", content: "please update memory" }],
      },
      headers: {
        "x-llamafile-mode": "cli",
        "x-llamafile-offline": "false",
      },
      socket: new EventEmitter(),
    }) as any;

    const res = Object.assign(new EventEmitter(), {
      headersSent: false,
      writableEnded: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      send: jest.fn(),
    }) as any;

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: [
          expect.objectContaining({
            finish_reason: "tool_calls",
            message: expect.objectContaining({
              content: null,
              tool_calls: [
                expect.objectContaining({
                  type: "function",
                  function: expect.objectContaining({
                    name: "update_memory",
                    arguments: JSON.stringify({
                      content: "Today's date is 2026-05-06.",
                    }),
                  }),
                }),
              ],
            }),
          }),
        ],
      }),
    );
  });

  it("normalizes stream CLI execute_tool text into tool_calls SSE", async () => {
    const spawnMock = jest
      .fn()
      .mockImplementation(() =>
        makeCliChild(
          '<execute_tool> update_memory(content="Today\'s date is 2026-05-06.") </execute_tool>',
        ),
      );

    jest.unstable_mockModule("node:child_process", () => ({
      spawn: spawnMock,
    }));
    jest.unstable_mockModule("node:fs/promises", () => ({
      readdir: jest.fn(async () => [
        {
          name: "tiny.llamafile",
          isFile: () => true,
        },
      ]),
      stat: jest.fn(async () => ({ isDirectory: () => true })),
      access: jest.fn(async () => undefined),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      unlink: jest.fn(),
    }));

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
    const handler = routes.get("POST /llamafile-proxy/chat/completions");

    const req = Object.assign(new EventEmitter(), {
      body: {
        model: "tiny",
        stream: true,
        messages: [{ role: "user", content: "please update memory" }],
      },
      headers: {
        "x-llamafile-mode": "cli",
        "x-llamafile-offline": "false",
      },
      socket: new EventEmitter(),
    }) as any;

    const res = Object.assign(new EventEmitter(), {
      headersSent: false,
      writableEnded: false,
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn(),
    }) as any;

    await handler(req, res);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const writes = res.write.mock.calls.map((call: any[]) => String(call[0]));
    const allOutput = writes.join("\n");

    expect(allOutput).toContain('"tool_calls"');
    expect(allOutput).toContain('"name":"update_memory"');
    expect(allOutput).toContain('"finish_reason":"tool_calls"');
    expect(allOutput).toContain("data: [DONE]");
  });

  it("writes intermediate chunks during CLI streaming", async () => {
    const spawnMock = jest.fn();
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.pid = 9999;
    child.kill = jest.fn();

    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit("spawn");
      });

      return child;
    });

    jest.unstable_mockModule("node:child_process", () => ({
      spawn: spawnMock,
    }));
    jest.unstable_mockModule("node:fs/promises", () => ({
      readdir: jest.fn(async () => [
        { name: "tiny.llamafile", isFile: () => true },
      ]),
      stat: jest.fn(async () => ({ isDirectory: () => true })),
      access: jest.fn(async () => undefined),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      unlink: jest.fn(),
    }));

    const mod = await import("./proxy.js?issue2=" + Date.now());
    const routes = new Map<string, any>();
    const app = {
      get: jest.fn(),
      post: jest.fn((path: string, handler: any) => {
        routes.set(`POST ${path}`, handler);
      }),
      all: jest.fn(),
    } as any;

    mod.registerProxyRoutes(app, { verbose: false });
    const handler = routes.get("POST /llamafile-proxy/chat/completions");

    const req = Object.assign(new EventEmitter(), {
      body: {
        model: "tiny",
        stream: true,
        messages: [{ role: "user", content: "hello" }],
      },
      headers: {
        "x-llamafile-mode": "cli",
        "x-llamafile-offline": "false",
      },
      socket: new EventEmitter(),
    }) as any;

    const res = Object.assign(new EventEmitter(), {
      headersSent: false,
      writableEnded: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    }) as any;

    const handlerPromise = handler(req, res);

    // Wait for spawn and for listeners to be attached
    // We need to wait enough for all async steps in invokeLlamafileCli to finish
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Emit some data
    const chunk1 = "Hello ";
    const chunk2 = "world!";
    child.stdout.emit("data", Buffer.from(chunk1, "utf8"));
    child.stdout.emit("data", Buffer.from(chunk2, "utf8"));

    // Check if res.write was called with these chunks
    // Note: filteredText might be empty if the filter is still waiting for prompt echo to finish
    // But in this case, since prompt is short, it should start emitting.
    // Actually, prompt echo filter might buffer.

    child.emit("close", 0);
    await handlerPromise;

    const writes = res.write.mock.calls.map((call: any[]) => String(call[0]));

    // We expect at least one write for "Hello " and one for "world!" (or combined if filtered)
    // The bug is that there are ZERO writes before res.end except for headers maybe.
    // Actually writeOpenAiDeltaChunk is what we expect.

    const deltaWrites = writes.filter((w) => w.includes('"delta"'));
    expect(deltaWrites.length).toBeGreaterThan(0);
  });
});

describe("GitHub Models / Copilot proxy", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("does not unconditionally log request body or response object", async () => {
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
    const handler = routes.get(
      "POST /copilot-proxy/azure-openai/chat/completions",
    );

    expect(handler).toBeDefined();

    // Mock fetch to return a valid response so we don't hit the network
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "application/json"]]),
      arrayBuffer: async () => new ArrayBuffer(0),
      text: async () => "{}",
      json: async () => ({ choices: [] }),
    }));

    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      const req = Object.assign(new EventEmitter(), {
        method: "POST",
        body: {
          model: "openai/gpt-4o",
          messages: [{ role: "user", content: "hello" }],
        },
        headers: {
          authorization: "Bearer test-key",
        },
        query: {},
      }) as any;

      const res = Object.assign(new EventEmitter(), {
        headersSent: false,
        writableEnded: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        send: jest.fn(),
      }) as any;

      await handler(req, res);

      // The handler must NOT produce unconditional console.log calls with
      // request body or response object — that leaks sensitive data.
      const unconditionalLogs = logSpy.mock.calls.filter((args) =>
        args.some(
          (arg) =>
            arg === "REQ" || arg === "RES" || String(arg).startsWith("REQ"),
        ),
      );
      expect(unconditionalLogs).toHaveLength(0);
    } finally {
      logSpy.mockRestore();
      globalThis.fetch = originalFetch;
    }
  });
});
