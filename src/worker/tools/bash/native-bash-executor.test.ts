import { describe, it, expect, afterEach } from "@jest/globals";
import { nativeBashExecutor } from "./native-bash-executor.js";

describe("nativeBashExecutor", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__getStorageRootPath;
  });

  it("executes a shell command and captures stdout", async () => {
    const output = await nativeBashExecutor({
      command: "echo 'hello from native bash'",
      timeoutSec: 5,
    });
    expect(output.trim()).toBe("hello from native bash");
  });

  it("handles stdin piped into commands", async () => {
    const output = await nativeBashExecutor({
      command: "cat",
      stdin: "piped content test",
      timeoutSec: 5,
    });
    expect(output.trim()).toBe("piped content test");
  });

  it("captures stderr when present", async () => {
    const output = await nativeBashExecutor({
      command: "node -e 'console.error(\"test stderr output\");'",
      timeoutSec: 5,
    });
    expect(output).toContain("test stderr output");
  });

  it("captures both stdout and stderr formatted with newline", async () => {
    const output = await nativeBashExecutor({
      command: 'node -e \'process.stdout.write("out"); console.error("err");\'',
      timeoutSec: 5,
    });
    expect(output).toContain("out\nerr");
  });

  it("falls back to error message when command fails with empty output", async () => {
    const output = await nativeBashExecutor({
      command: "node -e 'process.exit(42)'",
      timeoutSec: 5,
    });
    expect(output).toContain("Command failed");
  });

  it("uses __getStorageRootPath when provided on globalThis", async () => {
    (globalThis as Record<string, unknown>).__getStorageRootPath = () =>
      process.cwd();
    const output = await nativeBashExecutor({
      command: "pwd",
      timeoutSec: 5,
    });
    expect(output.trim()).toBe(process.cwd());
  });
});
