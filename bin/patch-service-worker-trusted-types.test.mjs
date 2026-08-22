import { describe, expect, it, jest } from "@jest/globals";

import { patchServiceWorkerTrustedTypesFile } from "./patch-service-worker-trusted-types.mjs";

describe("patchServiceWorkerTrustedTypesFile", () => {
  it("writes the patched service worker when content changes", async () => {
    const readFileImpl = jest.fn().mockResolvedValue("original");
    const writeFileImpl = jest.fn().mockResolvedValue(undefined);
    const patchImpl = jest.fn().mockReturnValue("patched");
    const logImpl = jest.fn();

    await patchServiceWorkerTrustedTypesFile("dist/service-worker.js", {
      readFileImpl,
      writeFileImpl,
      patchImpl,
      logImpl,
    });

    expect(readFileImpl).toHaveBeenCalledWith("dist/service-worker.js", "utf8");
    expect(patchImpl).toHaveBeenCalledWith("original");
    expect(writeFileImpl).toHaveBeenCalledWith(
      "dist/service-worker.js",
      "patched",
      "utf8",
    );
    expect(logImpl).toHaveBeenCalledWith(
      "Patched Trusted Types imports in dist/service-worker.js",
    );
  });

  it("does not rewrite an already patched service worker", async () => {
    const readFileImpl = jest.fn().mockResolvedValue("already patched");
    const writeFileImpl = jest.fn();
    const patchImpl = jest.fn().mockReturnValue("already patched");

    await patchServiceWorkerTrustedTypesFile("service-worker.js", {
      readFileImpl,
      writeFileImpl,
      patchImpl,
      logImpl: jest.fn(),
    });

    expect(writeFileImpl).not.toHaveBeenCalled();
  });

  it("uses the default service worker path when no target is supplied", async () => {
    const readFileImpl = jest.fn().mockResolvedValue("source");
    const patchImpl = jest.fn().mockReturnValue("source");

    await patchServiceWorkerTrustedTypesFile(undefined, {
      readFileImpl,
      patchImpl,
      logImpl: jest.fn(),
    });

    expect(readFileImpl).toHaveBeenCalledWith(
      expect.stringMatching(/dist\/public\/service-worker\.js$/),
      "utf8",
    );
  });

  it("propagates read failures", async () => {
    const error = new Error("missing service worker");

    await expect(
      patchServiceWorkerTrustedTypesFile("missing.js", {
        readFileImpl: jest.fn().mockRejectedValue(error),
        patchImpl: jest.fn(),
      }),
    ).rejects.toBe(error);
  });
});
