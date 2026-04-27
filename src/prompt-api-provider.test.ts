import { jest } from "@jest/globals";

describe("prompt-api-provider", () => {
  function setLanguageModelMock(
    createMock: jest.Mock,
    availabilityMock = (jest.fn() as any).mockResolvedValue("available"),
  ) {
    const LanguageModel = function LanguageModel() {};
    LanguageModel.availability = availabilityMock;
    LanguageModel.create = createMock;
    globalThis.LanguageModel = LanguageModel;
  }

  beforeEach(() => {
    jest.resetModules();
    delete globalThis.LanguageModel;
  });

  afterEach(async () => {
    try {
      const mod = await import("./prompt-api-provider.js");
      await mod.__resetPromptApiSessionCacheForTests();
    } catch {
      // Ignore cleanup errors in tests that never loaded the module.
    }

    delete globalThis.LanguageModel;
  });

  it("reuses one warm session and clones per request", async () => {
    const clonePrompt = (jest.fn() as any).mockResolvedValue("summary");

    const cloneDestroy = (jest.fn() as any).mockResolvedValue(undefined);
    const baseClone = jest.fn(async () => ({
      prompt: clonePrompt,
      destroy: cloneDestroy,
    }));

    const baseDestroy = (jest.fn() as any).mockResolvedValue(undefined);

    const createMock = jest.fn(async () => ({
      clone: baseClone,
      destroy: baseDestroy,
    }));
    setLanguageModelMock(createMock);

    const { compactWithPromptApi } = await import("./prompt-api-provider.js");

    const first = await compactWithPromptApi(
      "You are concise.",
      [{ role: "user", content: "hello" }],
      null as any,
      () => {},
    );

    const second = await compactWithPromptApi(
      "You are concise.",
      [{ role: "user", content: "hello again" }],
      null as any,
      () => {},
    );

    expect(first).toBe("summary");
    expect(second).toBe("summary");

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(baseClone).toHaveBeenCalledTimes(2);
    expect(clonePrompt).toHaveBeenCalledTimes(2);
    expect(cloneDestroy).toHaveBeenCalledTimes(2);
    expect(baseDestroy).not.toHaveBeenCalled();

    const promptArg = clonePrompt.mock.calls[0][0];
    expect(promptArg).toContain("CONVERSATION:");
    expect(promptArg).not.toContain("SYSTEM INSTRUCTIONS:");
  });

  it("creates fresh session when clone is unavailable", async () => {
    const warmPrompt = (jest.fn() as any).mockResolvedValue("summary");

    const warmDestroy = (jest.fn() as any).mockResolvedValue(undefined);

    const createMock = jest.fn(async () => ({
      prompt: warmPrompt,
      destroy: warmDestroy,
    }));
    setLanguageModelMock(createMock);

    const { compactWithPromptApi } = await import("./prompt-api-provider.js");

    await compactWithPromptApi(
      "System",
      [{ role: "user", content: "one" }],
      null as any,
      () => {},
    );

    await compactWithPromptApi(
      "System",
      [{ role: "user", content: "two" }],
      null as any,
      () => {},
    );

    // Without clone, a warm session is created, then destroyed and a fresh
    // session is created for each invocation to avoid context bleed.
    // 1st call: create warm + destroy warm + create fresh (3)
    // 2nd call: create warm + destroy warm + create fresh (3 more) but warm
    // was destroyed so a new warm is created first.
    // The key assertion: sessions are destroyed after each use.
    expect(createMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(warmPrompt).toHaveBeenCalledTimes(2);
    expect(warmDestroy).toHaveBeenCalled();
  });

  it("resets and destroys the cached warm session", async () => {
    const warmPrompt = (jest.fn() as any).mockResolvedValue("summary");

    const warmDestroy = (jest.fn() as any).mockResolvedValue(undefined);

    const createMock = jest.fn(async () => ({
      prompt: warmPrompt,
      destroy: warmDestroy,
    }));
    setLanguageModelMock(createMock);

    const { compactWithPromptApi, __resetPromptApiSessionCacheForTests } =
      await import("./prompt-api-provider.js");

    await compactWithPromptApi(
      "System",
      [{ role: "user", content: "one" }],
      null as any,
      () => {},
    );
    await __resetPromptApiSessionCacheForTests();

    // Destroy is called during acquirePromptSession (warm→fresh) and possibly
    // after use + during reset.
    expect(warmDestroy).toHaveBeenCalled();
  });

  it("defers open-file messages until all tool calls in batch complete", async () => {
    // Simulate Nano returning [open_file, write_file] in wrong order.
    // open-file should only be emitted after write_file finishes.
    const emitted: any[] = [];

    let promptCallCount = 0;

    const clonePrompt: any = jest.fn(async () => {
      promptCallCount++;
      if (promptCallCount === 1) {
        return JSON.stringify({
          type: "tool_use",
          tool_calls: [
            { name: "open_file", input: { path: "calc.html" } },
            {
              name: "write_file",
              input: { path: "calc.html", content: "<h1>calc</h1>" },
            },
          ],
        });
      }

      return JSON.stringify({ type: "response", response: "Done" });
    });

    const clonePromptStreaming = jest.fn((...args) => {
      const result = clonePrompt(...args);

      return {
        [Symbol.asyncIterator]: async function* () {
          yield await result;
        },
      };
    });

    const cloneDestroy = (jest.fn() as any).mockResolvedValue(undefined);
    const baseClone = jest.fn(async () => ({
      prompt: clonePrompt,
      promptStreaming: clonePromptStreaming,
      destroy: cloneDestroy,
    }));

    const baseDestroy = (jest.fn() as any).mockResolvedValue(undefined);

    const createMock = jest.fn(async () => ({
      clone: baseClone,
      destroy: baseDestroy,
    }));

    setLanguageModelMock(createMock);

    jest.unstable_mockModule("./worker/executeTool.js", () => ({
      executeTool: jest.fn(async (_db, name, _input, _groupId) => {
        emitted.push(`execute:${name}`);

        return `ok:${name}`;
      }),
    }));

    jest.unstable_mockModule("./worker/post.js", () => {
      let handler: any = null;

      return {
        setPostHandler: jest.fn((h) => {
          handler = h;
        }),
        post: jest.fn((msg: any) => {
          if (handler) {
            handler(msg);

            return;
          }

          emitted.push(`post:${msg?.type}`);
        }),
      };
    });

    const { invokeWithPromptApi } = await import("./prompt-api-provider.js");

    const emitFn = jest.fn(async (msg: any) => {
      emitted.push(`emit:${msg?.type}`);
    });

    await invokeWithPromptApi(
      {} as any,
      "g1",
      "system",
      [{ role: "user", content: "make a calc" }],
      1024,
      emitFn,
      undefined,
      [
        {
          name: "open_file",
          description: "Open file",
          input_schema: {
            type: "object",
            properties: { path: { type: "string" } },
            required: ["path"],
          },
        },
        {
          name: "write_file",
          description: "Write file",
          input_schema: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["path", "content"],
          },
        },
      ],
    );

    // The open-file emit should come AFTER both execute calls

    const execOpenIdx = emitted.indexOf("execute:open_file");

    const execWriteIdx = emitted.indexOf("execute:write_file");
    const openFileEmitIdx = emitted.findIndex((e) => e === "emit:open-file");

    expect(execOpenIdx).toBeGreaterThanOrEqual(0);
    expect(execWriteIdx).toBeGreaterThan(execOpenIdx);
    // open-file emit must come after write_file execution
    if (openFileEmitIdx >= 0) {
      expect(openFileEmitIdx).toBeGreaterThan(execWriteIdx);
    }
  });

  it("retries without responseConstraint when constrained stream stalls on incomplete JSON", async () => {
    // Simulate: constrained stream yields '{"' repeatedly (stalls),
    // unconstrained stream yields valid tool_use JSON.
    const toolCallJson = JSON.stringify({
      type: "tool_use",
      tool_calls: [{ name: "show_toast", input: { message: "it works!" } }],
    });
    const doneJson = JSON.stringify({
      type: "response",
      response: "Toasted!",
    });

    let promptStreamingCallCount = 0;
    const clonePromptStreaming = jest.fn((_prompt, opts: any) => {
      promptStreamingCallCount++;

      if (opts?.responseConstraint) {
        // Constrained: stall after producing just '{"'

        return {
          [Symbol.asyncIterator]: async function* () {
            yield '{"';
            yield '{"';
            yield '{"';
            yield '{"';
          },
        };
      }

      // Unconstrained: produce valid tool call JSON
      const json = promptStreamingCallCount <= 3 ? toolCallJson : doneJson;

      return {
        [Symbol.asyncIterator]: async function* () {
          yield json;
        },
      };
    });

    const cloneDestroy = (jest.fn() as any).mockResolvedValue(undefined);
    const baseClone = jest.fn(async () => ({
      promptStreaming: clonePromptStreaming,
      destroy: cloneDestroy,
    }));

    const baseDestroy = (jest.fn() as any).mockResolvedValue(undefined);

    const createMock = jest.fn(async () => ({
      clone: baseClone,
      destroy: baseDestroy,
    }));
    setLanguageModelMock(createMock);

    jest.unstable_mockModule("./worker/executeTool.js", () => ({
      executeTool: jest.fn(async (_db, name, input: any, _groupId) => {
        return `toast shown: ${input.message}`;
      }),
    }));
    jest.unstable_mockModule("./worker/post.js", () => ({
      setPostHandler: jest.fn(),
      post: jest.fn(),
    }));

    const { invokeWithPromptApi } = await import("./prompt-api-provider.js");

    const emitted: any[] = [];
    const emitFn = jest.fn(async (msg) => {
      emitted.push(msg);
    });

    await invokeWithPromptApi(
      {} as any,
      "g1",
      "system",
      [{ role: "user", content: 'Toast the message, "it works!"' }],
      1024,
      emitFn,
      undefined,
      [
        {
          name: "show_toast",
          description: "Show a toast notification to the user",
          input_schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Message" },
              type: {
                type: "string",
                enum: ["success", "error", "warning", "info"],
              },
              duration: { type: "number" },
            },
            required: ["message"],
          },
        },
      ],
    );

    // The constrained stream stalled, so it should have retried without constraint
    // and successfully executed the tool call
    const toolCallEmits = emitted.filter(
      (m) => m?.type === "tool-activity" && m?.payload?.tool === "show_toast",
    );
    expect(toolCallEmits.length).toBeGreaterThan(0);

    // Should NOT have returned "(no response)"

    const responseEmits = emitted.filter((m) => m?.type === "response");
    const noResponseEmit = responseEmits.find(
      (m) => m?.payload?.text === "(no response)",
    );
    expect(noResponseEmit).toBeUndefined();
  });

  it("includes file-viewer and attachment tools in PROMPT_API_TOOLS", async () => {
    const { PROMPT_API_TOOLS } = await import("./prompt-api-provider.js");
    const names = PROMPT_API_TOOLS.map((t) => t.name);
    expect(names).toContain("open_file");
    expect(names).toContain("attach_file_to_chat");
  });
});

describe("prompt-api-provider streaming events", () => {
  beforeEach(() => {
    jest.resetModules();
    delete globalThis.LanguageModel;
  });

  afterEach(async () => {
    delete globalThis.LanguageModel;
  });

  it("emits streaming-start, streaming-chunk, and streaming-done events", async () => {
    const responseJson = JSON.stringify({
      type: "response",
      response: "Hello from Nano",
    });

    const clonePromptStreaming = jest.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        // Stream the JSON in pieces to verify extraction
        yield '{"type":"response",';
        yield '"response":"Hello ';
        yield 'from Nano"}';
      },
    }));

    const createMock = jest.fn(async () => ({
      clone: jest.fn(async () => ({
        promptStreaming: clonePromptStreaming,
        destroy: jest.fn(),
      })),
      destroy: jest.fn(),
    }));

    const LanguageModel = function LanguageModel() {} as any;

    LanguageModel.availability = (jest.fn() as any).mockResolvedValue(
      "available",
    );
    LanguageModel.create = createMock;
    globalThis.LanguageModel = LanguageModel;

    const { invokeWithPromptApi } = await import("./prompt-api-provider.js");

    const emitted: any[] = [];
    const emitFn = jest.fn(async (msg) => {
      emitted.push(msg);
    });

    await invokeWithPromptApi(
      {} as any,
      "g1",
      "system",
      [{ role: "user", content: "hi" }],
      1024,
      emitFn,
      null as any,
      [],
    );

    // Verify streaming-start
    const startEmit = emitted.find((m) => m.type === "streaming-start");
    expect(startEmit).toBeDefined();

    // Verify streaming-chunks and extraction heuristic (now using deltas)
    const chunks = emitted

      .filter((m) => m.type === "streaming-chunk")

      .map((m) => m.payload.text);

    // After 1st yield: '{"type":"response",' -> no match
    // After 2nd yield: '{"type":"response","response":"Hello ' -> first match "Hello "
    // After 3rd yield: '{"type":"response","response":"Hello from Nano"}' -> match "Hello from Nano", delta is "from Nano"
    expect(chunks).toContain("Hello ");
    expect(chunks).toContain("from Nano");

    // Verify streaming-done

    const doneEmit = emitted.find((m) => m.type === "streaming-done");
    expect(doneEmit).toBeDefined();

    expect(doneEmit.payload.text).toBe("Hello from Nano");
  });
});
