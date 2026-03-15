import { pwdCommand } from "./pwd.mjs";

function ok(stdout) {
  return { stdout, stderr: "", exitCode: 0 };
}

describe("pwdCommand", () => {
  it("returns the workspace root for '.'", async () => {
    const output = await pwdCommand({
      ctx: { cwd: "." },
      ok,
    });

    expect(output).toEqual({ result: ok("/workspace\n") });
  });

  it("returns the nested workspace path for non-root directories", async () => {
    const output = await pwdCommand({
      ctx: { cwd: "nested/path" },
      ok,
    });

    expect(output).toEqual({ result: ok("/workspace/nested/path\n") });
  });

  it("pwd", async () => {
    const output = await pwdCommand({
      args: [],
      ctx: { cwd: ".", env: { PWD: "/workspace" } },
      ok,
    });

    expect(output).toEqual({ result: ok("/workspace\n") });
  });

  it("-P", async () => {
    const output = await pwdCommand({
      args: ["-P"],
      ctx: { cwd: ".", env: { PWD: "/workspace" } },
      ok,
    });

    expect(output).toEqual({ result: ok("/workspace\n") });
  });

  it("pwd2", async () => {
    const output = await pwdCommand({
      args: [],
      ctx: { cwd: "sym", env: { PWD: "/workspace/sym" } },
      ok,
    });

    expect(output).toEqual({ result: ok("/workspace/sym\n") });
  });

  it("-P2", async () => {
    const output = await pwdCommand({
      args: ["-P"],
      ctx: { cwd: "sym", env: { PWD: "/workspace/sym" } },
      ok,
    });

    expect(output).toEqual({ result: ok("/workspace/sym\n") });
  });

  it("(bad PWD)", async () => {
    const output = await pwdCommand({
      args: [],
      ctx: { cwd: ".", env: { PWD: "walrus" } },
      ok,
    });

    expect(output).toEqual({ result: ok("/workspace\n") });
  });
});
