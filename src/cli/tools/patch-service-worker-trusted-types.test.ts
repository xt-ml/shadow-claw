import { describe, expect, it, jest } from "@jest/globals";

import {
  patchServiceWorkerTrustedTypesFile,
  main,
} from "./patch-service-worker-trusted-types.js";

describe("patchServiceWorkerTrustedTypesFile", () => {
  it("writes the patched service worker when content changes", async () => {
    const readFileImpl = jest.fn<any>().mockResolvedValue("original");
    const writeFileImpl = jest.fn<any>().mockResolvedValue(undefined);
    const patchImpl = jest.fn<any>().mockReturnValue("patched");
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
    const readFileImpl = jest.fn<any>().mockResolvedValue("already patched");
    const writeFileImpl = jest.fn<any>();
    const patchImpl = jest.fn<any>().mockReturnValue("already patched");

    await patchServiceWorkerTrustedTypesFile("service-worker.js", {
      readFileImpl,
      writeFileImpl,
      patchImpl,
      logImpl: jest.fn(),
    });

    expect(writeFileImpl).not.toHaveBeenCalled();
  });

  it("uses the default service worker path when no target is supplied", async () => {
    const readFileImpl = jest.fn<any>().mockResolvedValue("source");
    const patchImpl = jest.fn<any>().mockReturnValue("source");

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
        readFileImpl: jest.fn<any>().mockRejectedValue(error),
        patchImpl: jest.fn<any>(),
      }),
    ).rejects.toBe(error);
  });

  it("main() patches target path specified in process.argv[2]", async () => {
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sw-patch-"));
    const tempFile = path.join(tempDir, "service-worker.js");
    await fs.writeFile(tempFile, "/* sw content */", "utf8");

    const prevArgv = process.argv;
    try {
      process.argv = ["node", "patch.js", tempFile];
      await main();
      const content = await fs.readFile(tempFile, "utf8");
      expect(content).toBeDefined();
    } finally {
      process.argv = prevArgv;
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
