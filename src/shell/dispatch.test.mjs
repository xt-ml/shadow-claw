import { jest } from "@jest/globals";

jest.unstable_mockModule("./commands/registry.mjs", () => ({
  COMMAND_HANDLERS: {
    mocked: jest.fn(async ({ ok }) => ({ result: ok("done") })),
    updateCtx: jest.fn(async ({ ok }) => ({
      result: ok(""),
      nextCtx: { cwd: "/next", env: { NEXT: "1" } },
    })),
  },
}));

describe("dispatch.mjs", () => {
  let dispatch;

  beforeEach(async () => {
    jest.resetModules();

    dispatch = (await import("./dispatch.mjs")).dispatch;
  });

  it("returns 127 for unknown command", async () => {
    const result = await dispatch({}, "missing", [], { cwd: ".", env: {} }, "");

    expect(result.exitCode).toBe(127);

    expect(result.stderr).toContain("command not found");
  });

  it("invokes mapped command handler", async () => {
    const result = await dispatch(
      {},
      "mocked",
      ["a"],
      { cwd: ".", env: { PWD: "/workspace" }, groupId: "g" },
      "stdin",
    );

    expect(result.stdout).toBe("done");

    expect(result.exitCode).toBe(0);
  });

  it("applies nextCtx updates", async () => {
    const ctx = { cwd: ".", env: { PWD: "/workspace" }, groupId: "g" };
    await dispatch({}, "updateCtx", [], ctx, "");

    expect(ctx.cwd).toBe("/next");

    expect(ctx.env).toEqual({ NEXT: "1" });
  });
});
