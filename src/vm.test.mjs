import { executeInVM, isVMReady, shutdownVM } from "./vm.mjs";

describe("vm wrapper", () => {
  it("reports not ready and returns fallback error output", async () => {
    expect(isVMReady()).toBe(false);
    const out = await executeInVM("echo hi");
    expect(out).toContain("WebVM is not available");
  });

  it("shutdown is safe when VM is not booted", async () => {
    await expect(shutdownVM()).resolves.toBeUndefined();
  });
});
