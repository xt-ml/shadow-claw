import { jest } from "@jest/globals";

import {
  bootVM,
  executeInVM,
  getVMStatus,
  isVMReady,
  setVMBootModePreference,
  shutdownVM,
} from "./vm.mjs";

describe("vm wrapper", () => {
  afterEach(async () => {
    delete global.fetch;
    await shutdownVM();
  });

  it("reports not ready and returns fallback error output", async () => {
    expect(isVMReady()).toBe(false);
    const out = await executeInVM("echo hi");
    expect(out).toContain("WebVM is not available");
  });

  it("shutdown is safe when VM is not booted", async () => {
    await expect(shutdownVM()).resolves.toBeUndefined();
  });

  it("defaults to disabled boot mode", () => {
    expect(getVMStatus()).toMatchObject({
      ready: false,
      booting: false,
      bootAttempted: false,
      error: "WebVM is disabled. Enable it in Settings to use WebVM.",
    });
  });

  it("resets boot state on shutdown", async () => {
    setVMBootModePreference("ext2");
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    await bootVM();
    expect(getVMStatus().bootAttempted).toBe(true);

    await shutdownVM();

    expect(getVMStatus()).toMatchObject({
      ready: false,
      booting: false,
      bootAttempted: false,
      error: null,
    });
  });
});
