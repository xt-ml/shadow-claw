// @ts-nocheck
import { jest } from "@jest/globals";

describe("sandboxedEval", () => {
  let sandboxedEval;
  let JS_EXEC_TIMEOUT_MS;

  // Track workers created so we can verify termination
  let mockWorkerInstances;
  let originalWorker;

  beforeEach(async () => {
    jest.resetModules();
    mockWorkerInstances = [];

    // Mock URL.createObjectURL / revokeObjectURL
    global.URL = global.URL || {};
    global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = jest.fn();

    // Mock Blob
    global.Blob = jest.fn().mockImplementation((parts, options) => ({
      parts,
      options,
    }));

    // Mock Worker
    originalWorker = (global as any).Worker;
    (global as any).Worker = jest.fn().mockImplementation(() => {
      const instance: any = {
        postMessage: jest.fn(),
        terminate: jest.fn(),
        onmessage: null,
        onerror: null,
      };

      // By default, simulate successful execution of "1+1" → 2
      setTimeout(() => {
        if (instance.onmessage) {
          instance.onmessage({ data: { ok: true, value: 2 } });
        }
      }, 0);

      mockWorkerInstances.push(instance);

      return instance;
    });

    const mod = await import("./sandboxedEval.js");
    sandboxedEval = mod.sandboxedEval;
    JS_EXEC_TIMEOUT_MS = mod.JS_EXEC_TIMEOUT_MS;
  });

  afterEach(() => {
    (global as any).Worker = originalWorker;
    delete (global as any).trustedTypes;
  });

  it("exports a default timeout of 30 seconds", () => {
    expect(JS_EXEC_TIMEOUT_MS).toBe(30_000);
  });

  it("creates a Blob and Worker for execution", async () => {
    await sandboxedEval("1+1");

    expect(global.Blob).toHaveBeenCalledTimes(1);
    expect(global.Blob).toHaveBeenCalledWith([expect.any(String)], {
      type: "application/javascript",
    });

    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect((global as any).Worker).toHaveBeenCalledWith("blob:mock-url");
  });

  it("uses a Trusted Types script URL for Worker when available", async () => {
    const createScriptURL = jest.fn((value: string) => `trusted:${value}`);
    (global as any).trustedTypes = {
      createPolicy: jest.fn(() => ({
        createScriptURL,
      })),
    };

    await sandboxedEval("1+1");

    expect((global as any).trustedTypes.createPolicy).toHaveBeenCalledWith(
      "shadowclaw-sandbox",
      expect.objectContaining({
        createScriptURL: expect.any(Function),
      }),
    );
    expect(createScriptURL).toHaveBeenCalledWith("blob:mock-url");
    expect((global as any).Worker).toHaveBeenCalledWith(
      "trusted:blob:mock-url",
    );
  });

  it("executes without runtime postMessage", async () => {
    await sandboxedEval("2+2");

    expect(mockWorkerInstances[0].postMessage).not.toHaveBeenCalled();
  });

  it("returns ok: true with the result value", async () => {
    const result = await sandboxedEval("1+1");

    expect(result).toEqual({ ok: true, value: 2 });
  });

  it("terminates the worker after successful execution", async () => {
    await sandboxedEval("1+1");

    expect(mockWorkerInstances[0].terminate).toHaveBeenCalled();
  });

  it("revokes the blob URL after execution", async () => {
    await sandboxedEval("1+1");

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("returns ok: false when the worker reports an error", async () => {
    (global as any).Worker = jest.fn().mockImplementation(() => {
      const instance: any = {
        postMessage: jest.fn(),
        terminate: jest.fn(),
        onmessage: null,
        onerror: null,
      };
      setTimeout(() => {
        if (instance.onmessage) {
          instance.onmessage({
            data: { ok: false, error: "ReferenceError: x is not defined" },
          });
        }
      }, 0);
      mockWorkerInstances.push(instance);

      return instance;
    });

    jest.resetModules();
    const mod = await import("./sandboxedEval.js");

    const result = await mod.sandboxedEval("x");
    expect(result).toEqual({
      ok: false,
      error: "ReferenceError: x is not defined",
    });
  });

  it("returns ok: false on worker onerror", async () => {
    (global as any).Worker = jest.fn().mockImplementation(() => {
      const instance: any = {
        postMessage: jest.fn(),
        terminate: jest.fn(),
        onmessage: null,
        onerror: null,
      };
      setTimeout(() => {
        if (instance.onerror) {
          instance.onerror({ message: "Script parse error" });
        }
      }, 0);
      mockWorkerInstances.push(instance);

      return instance;
    });

    jest.resetModules();
    const mod = await import("./sandboxedEval.js");

    const result = await mod.sandboxedEval("@@@");
    expect(result).toEqual({
      ok: false,
      error: "Script parse error",
    });
  });

  it("times out and terminates the worker for long-running code", async () => {
    // Make the worker never respond
    (global as any).Worker = jest.fn().mockImplementation(() => {
      const instance: any = {
        postMessage: jest.fn(), // no-op — never calls onmessage
        terminate: jest.fn(),
        onmessage: null,
        onerror: null,
      };
      mockWorkerInstances.push(instance);

      return instance;
    });

    jest.resetModules();
    const mod = await import("./sandboxedEval.js");

    const result = await mod.sandboxedEval("while(true){}", 100);

    expect(result).toEqual({
      ok: false,
      error: "Execution timed out after 0.1s",
    });
    expect(mockWorkerInstances[0].terminate).toHaveBeenCalled();
  });

  it("handles onerror with no message", async () => {
    (global as any).Worker = jest.fn().mockImplementation(() => {
      const instance: any = {
        postMessage: jest.fn(),
        terminate: jest.fn(),
        onmessage: null,
        onerror: null,
      };
      setTimeout(() => {
        if (instance.onerror) {
          instance.onerror({} as any);
        }
      }, 0);
      mockWorkerInstances.push(instance);

      return instance;
    });

    jest.resetModules();
    const mod = await import("./sandboxedEval.js");

    const result = await mod.sandboxedEval("bad");
    expect(result).toEqual({
      ok: false,
      error: "Unknown worker error",
    });
  });

  it("each invocation creates a fresh worker (no state leakage)", async () => {
    await sandboxedEval("var x = 1; x");
    await sandboxedEval("x"); // would fail in unsandboxed eval

    // Two separate Worker instances were created
    expect(mockWorkerInstances).toHaveLength(2);
    expect(mockWorkerInstances[0]).not.toBe(mockWorkerInstances[1]);

    // Both were terminated
    expect(mockWorkerInstances[0].terminate).toHaveBeenCalled();
    expect(mockWorkerInstances[1].terminate).toHaveBeenCalled();
  });
});

describe("buildWorkerSource — generated code validity", () => {
  let buildWorkerSource;

  beforeEach(async () => {
    jest.resetModules();
    const mod = await import("./sandboxedEval.js");
    buildWorkerSource = mod.buildWorkerSource;
  });

  it("is exported so the generated source can be tested", () => {
    expect(typeof buildWorkerSource).toBe("function");
  });

  it("generates syntactically valid JavaScript", () => {
    const source = buildWorkerSource("return 1 + 1;");
    expect(() => {
      // eslint-disable-next-line no-new-func
      new Function(source);
    }).not.toThrow();
  });

  it("includes blocked globals metadata in generated source", () => {
    const source = buildWorkerSource("return 1;");
    const blockedMatch = source.match(/const blocked = (\[.*?\]);/s);
    expect(blockedMatch).not.toBeNull();
    const blocked = JSON.parse(blockedMatch[1]);
    expect(Array.isArray(blocked)).toBe(true);
    expect(blocked.length).toBeGreaterThan(0);
  });

  it("awaits async code execution path", () => {
    const source = buildWorkerSource("return Promise.resolve(1);");
    expect(source).toContain("const result = await (async () => {");
  });

  it("preserves worker postMessage channel for results", () => {
    const source = buildWorkerSource("return 1;");
    expect(source).toContain("const __hostPostMessage =");
    expect(source).toContain('name === "self" || name === "postMessage"');
    expect(source).toContain("__hostPostMessage({ ok: true");
  });

  it("does not shadow fetch when full internet access is enabled", () => {
    const source = buildWorkerSource("return 1;", true);
    const blockedMatch = source.match(/const blocked = (\[.*?\]);/s);
    const blocked = JSON.parse(blockedMatch[1]);

    expect(blocked).not.toContain("fetch");
  });

  it("shadows fetch when full internet access is disabled", () => {
    const source = buildWorkerSource("return 1;", false);
    const blockedMatch = source.match(/const blocked = (\[.*?\]);/s);
    const blocked = JSON.parse(blockedMatch[1]);

    expect(blocked).toContain("fetch");
  });
});
