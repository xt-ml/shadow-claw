import { whichCommand } from "./which.mjs";

function ok(stdout) {
  return { stdout, stderr: "", exitCode: 0 };
}

function fail(stderr, code = 1) {
  return { stdout: "", stderr, exitCode: code };
}

describe("whichCommand", () => {
  it("returns the command path for supported commands", async () => {
    const output = await whichCommand({
      args: ["-a", "echo"],
      ok,
      fail,
    });

    expect(output).toEqual({ result: ok("/usr/bin/echo\n") });
  });

  it("returns an error when the command is not supported", async () => {
    const output = await whichCommand({
      args: ["-a", "not-a-command"],
      ok,
      fail,
    });

    expect(output).toEqual({
      result: fail("which: not-a-command: not found"),
    });
  });
});
