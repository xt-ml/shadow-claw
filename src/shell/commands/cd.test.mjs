import { cdCommand } from "./cd.mjs";

function ok(stdout) {
  return { stdout, stderr: "", exitCode: 0 };
}

describe("cdCommand", () => {
  it("defaults to the current directory when no target is provided", async () => {
    const ctx = {
      cwd: "nested/path",
      env: { PWD: "/workspace/nested/path", HOME: "/workspace" },
    };

    const output = await cdCommand({ args: [], ctx, ok });

    expect(output).toEqual({
      result: ok(""),
      nextCtx: {
        cwd: "nested/path",
        env: {
          PWD: "/workspace/nested/path",
          HOME: "/workspace",
        },
      },
    });
  });

  it("resolves the provided target and updates PWD", async () => {
    const ctx = {
      cwd: "projects/demo",
      env: { PWD: "/workspace/projects/demo", HOME: "/workspace" },
    };

    const output = await cdCommand({ args: ["../logs"], ctx, ok });

    expect(output).toEqual({
      result: ok(""),
      nextCtx: {
        cwd: "projects/logs",
        env: {
          PWD: "/workspace/projects/logs",
          HOME: "/workspace",
        },
      },
    });
  });
});
