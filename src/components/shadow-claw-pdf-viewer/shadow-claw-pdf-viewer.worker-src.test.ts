import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

const originalTrustedTypes = globalThis.trustedTypes;

describe("shadow-claw-pdf-viewer workerSrc", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    if (originalTrustedTypes === undefined) {
      delete (globalThis as typeof globalThis & { trustedTypes?: unknown })
        .trustedTypes;
    } else {
      Object.defineProperty(globalThis, "trustedTypes", {
        configurable: true,
        value: originalTrustedTypes,
      });
    }
  });

  it("keeps pdf.js workerSrc as a plain string when Trusted Types are available", async () => {
    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: {
        createPolicy: () => ({
          createHTML: (input: string) => input,
          createScriptURL: (input: string) => ({
            toString: () => input,
          }),
        }),
      },
    });

    const globalWorkerOptions = { workerSrc: "" };

    jest.unstable_mockModule("pdfjs-dist", () => ({
      GlobalWorkerOptions: globalWorkerOptions,
      getDocument: jest.fn(),
    }));

    await import("./shadow-claw-pdf-viewer.js");

    expect(typeof globalWorkerOptions.workerSrc).toBe("string");
    expect(globalWorkerOptions.workerSrc).toBe("./pdf.worker.js");
  });
});
