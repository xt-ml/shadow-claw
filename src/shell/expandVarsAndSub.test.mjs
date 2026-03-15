import { jest } from "@jest/globals";

// Mock dependencies
jest.unstable_mockModule("./runPipeline.mjs", () => ({
  runPipeline: jest.fn(),
}));

describe("expandVarsAndSub.mjs", () => {
  let expandVarsAndSub;
  let runPipeline;

  beforeEach(async () => {
    jest.resetModules();

    runPipeline = (await import("./runPipeline.mjs")).runPipeline;
    expandVarsAndSub = (await import("./expandVarsAndSub.mjs"))
      .expandVarsAndSub;
  });

  const db = {};
  const ctx = {
    env: {
      FOO: "bar",
      BAZ: "qux",
    },
  };

  it("should expand simple variables", async () => {
    const result = await expandVarsAndSub(db, "hello $FOO", ctx);

    expect(result).toBe("hello bar");
  });

  it("should expand braced variables", async () => {
    const result = await expandVarsAndSub(db, "hello ${BAZ}", ctx);

    expect(result).toBe("hello qux");
  });

  it("should handle missing variables", async () => {
    const result = await expandVarsAndSub(db, "hello $MISSING", ctx);

    expect(result).toBe("hello ");
  });

  it("should handle command substitution", async () => {
    runPipeline.mockResolvedValueOnce({
      stdout: "cmd output\n",
      stderr: "",
      exitCode: 0,
    });

    const result = await expandVarsAndSub(db, "echo $(some command)", ctx);

    expect(result).toBe("echo cmd output");

    expect(runPipeline).toHaveBeenCalledWith(db, "some command", ctx);
  });

  it("should handle nested command substitution", async () => {
    // IT CALLS runPipeline ONCE for the whole outer thing.
    runPipeline.mockResolvedValueOnce({
      stdout: "outer inner\n",
      stderr: "",
      exitCode: 0,
    });

    const result = await expandVarsAndSub(
      db,
      "result: $(echo outer $(echo inner))",
      ctx,
    );

    expect(result).toBe("result: outer inner");

    expect(runPipeline).toHaveBeenCalledWith(
      db,
      "echo outer $(echo inner)",
      ctx,
    );
  });
});
