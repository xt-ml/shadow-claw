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
      instance.postMessage.mockImplementation((msg) => {
        // Simulate async worker response
        setTimeout(() => {
          if (instance.onmessage) {
            instance.onmessage({ data: { ok: true, value: 2 } });
          }
        }, 0);
      });

      mockWorkerInstances.push(instance);

      return instance;
    });

    const mod = await import("./sandboxedEval.js");
    sandboxedEval = mod.sandboxedEval;
    JS_EXEC_TIMEOUT_MS = mod.JS_EXEC_TIMEOUT_MS;
  });

  afterEach(() => {
    (global as any).Worker = originalWorker;
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

  it("sends code to the worker via postMessage", async () => {
    await sandboxedEval("2+2");

    expect(mockWorkerInstances[0].postMessage).toHaveBeenCalledWith({
      code: "2+2",
    });
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
        postMessage: jest.fn().mockImplementation(() => {
          setTimeout(() => {
            if (instance.onmessage) {
              instance.onmessage({
                data: { ok: false, error: "ReferenceError: x is not defined" },
              });
            }
          }, 0);
        }),
        terminate: jest.fn(),
        onmessage: null,
        onerror: null,
      };
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
        postMessage: jest.fn().mockImplementation(() => {
          setTimeout(() => {
            if (instance.onerror) {
              instance.onerror({ message: "Script parse error" });
            }
          }, 0);
        }),
        terminate: jest.fn(),
        onmessage: null,
        onerror: null,
      };
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
        postMessage: jest.fn().mockImplementation(() => {
          setTimeout(() => {
            if (instance.onerror) {
              instance.onerror({} as any);
            }
          }, 0);
        }),
        terminate: jest.fn(),
        onmessage: null,
        onerror: null,
      };
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
    const source = buildWorkerSource();
    // The generated code must parse without throwing.
    // We strip the `self.onmessage` wrapper and test the inner new Function call
    // by actually constructing the function the same way the worker does.
    expect(() => {
      // eslint-disable-next-line no-new-func
      new Function(source);
    }).not.toThrow();
  });

  it("new Function with blocked globals as params does not throw in strict mode", () => {
    // This is the core bug: "eval" and "arguments" as parameter names
    // are illegal in strict mode. The outer Function body must NOT be strict.
    const source = buildWorkerSource();

    // Extract the blocked globals and simulate what the worker does
    const blockedMatch = source.match(/var blocked = (\[.*?\]);/s);
    expect(blockedMatch).not.toBeNull();
    const blocked = JSON.parse(blockedMatch[1]);
    const paramNames = blocked.join(",");

    // This must not throw — it's the exact call that happens at runtime
    expect(() => {
      // eslint-disable-next-line no-new-func
      const fn = new Function(
        paramNames,
        'return (function(){\n"use strict";\nreturn 1+1;\n})()',
      );
      const args = new Array(blocked.length);
      const result = fn.apply(undefined, args);
      expect(result).toBe(2);
    }).not.toThrow();
  });

  it("user code runs in strict mode even though outer Function is sloppy", () => {
    const source = buildWorkerSource();
    const blockedMatch = source.match(/var blocked = (\[.*?\]);/s);
    const blocked = JSON.parse(blockedMatch[1]);
    const paramNames = blocked.join(",");

    // User code that violates strict mode (e.g. octal literal) should fail
    const wrappedCode = 'return (function(){\n"use strict";\nreturn 010;\n})()';
    expect(() => {
      // eslint-disable-next-line no-new-func
      new Function(paramNames, wrappedCode);
    }).toThrow();
  });

  it("eval and Function are shadowed as undefined inside user code", () => {
    const source = buildWorkerSource();
    const blockedMatch = source.match(/var blocked = (\[.*?\]);/s);
    const blocked = JSON.parse(blockedMatch[1]);
    const paramNames = blocked.join(",");

    // User code that tries to use eval should get undefined
    const wrappedCode =
      'return (function(){\n"use strict";\nreturn typeof eval;\n})()';
    // eslint-disable-next-line no-new-func
    const fn = new Function(paramNames, wrappedCode);
    const args = new Array(blocked.length); // all undefined
    const result = fn.apply(undefined, args);
    expect(result).toBe("undefined");
  });
});
