import { commandCommand } from "./command.mjs";

function ok(stdout) {
  return { stdout, stderr: "", exitCode: 0 };
}

function fail(stderr, code = 1) {
  return { stdout: "", stderr, exitCode: code };
}

describe("commandCommand", () => {
  it("returns the command path for supported commands", async () => {
    const output = await commandCommand({
      args: ["-v", "echo"],
      ok,
      fail,
    });

    expect(output).toEqual({ result: ok("/usr/bin/echo\n") });
  });

  it("returns an error when the command is not supported", async () => {
    const output = await commandCommand({
      args: ["-v", "not-a-command"],
      ok,
      fail,
    });

    expect(output).toEqual({
      result: fail("command: not-a-command: not found"),
    });
  });
});
