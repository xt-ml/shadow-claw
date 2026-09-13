import { describe, it, expect } from "@jest/globals";
import { nativeBashExecutor } from "./native-bash-executor.js";

describe("nativeBashExecutor", () => {
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
});
