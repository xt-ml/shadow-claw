import { describe, expect, it } from "@jest/globals";

import {
  MONACO_WORKER_FILES,
  registerMonacoWorker,
  resolveMonacoWorkerFile,
} from "./monaco-worker-labels.js";

describe("resolveMonacoWorkerFile", () => {
  it("maps built-in language labels to worker files", () => {
    expect(resolveMonacoWorkerFile("json")).toBe("json.worker.js");
    expect(resolveMonacoWorkerFile("css")).toBe("css.worker.js");
    expect(resolveMonacoWorkerFile("scss")).toBe("css.worker.js");
    expect(resolveMonacoWorkerFile("less")).toBe("css.worker.js");
    expect(resolveMonacoWorkerFile("html")).toBe("html.worker.js");
    expect(resolveMonacoWorkerFile("handlebars")).toBe("html.worker.js");
  });

  it("falls back to the generic editor worker", () => {
    expect(resolveMonacoWorkerFile("markdown")).toBe("editor.worker.js");
    expect(resolveMonacoWorkerFile("mermaid")).toBe("editor.worker.js");
    expect(resolveMonacoWorkerFile("")).toBe("editor.worker.js");
  });

  it("never returns a path outside the worker directory", () => {
    for (const file of Object.values(MONACO_WORKER_FILES)) {
      expect(file).toMatch(/^[a-z-]+\.worker\.js$/);
    }
  });

  it("allows future workers to be registered", () => {
    registerMonacoWorker("typescript", "ts.worker.js");
    registerMonacoWorker("javascript", "ts.worker.js");

    expect(resolveMonacoWorkerFile("typescript")).toBe("ts.worker.js");
    expect(resolveMonacoWorkerFile("javascript")).toBe("ts.worker.js");
  });

  it("rejects unsafe worker file names", () => {
    expect(() => registerMonacoWorker("evil", "../evil.js")).toThrow();
    expect(() =>
      registerMonacoWorker("evil", "https://x/y.worker.js"),
    ).toThrow();
  });
});
