import { jest } from "@jest/globals";

const testExpr = jest.fn();

jest.unstable_mockModule("../testExpr.mjs", () => ({
  testExpr,
}));

const { testCommand } = await import("./shellTestCommand.mjs");

describe("testCommand", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("passes the full argument list to testExpr", async () => {
    const expectedResult = { stdout: "", stderr: "", exitCode: 1 };
    const db = {};
    const ctx = { groupId: "g1", cwd: ".", env: { PWD: "/workspace" } };
    testExpr.mockResolvedValue(expectedResult);

    const output = await testCommand({
      db,
      args: ["foo", "!=", "bar"],
      ctx,
    });

    expect(testExpr).toHaveBeenCalledWith(db, ["foo", "!=", "bar"], ctx);

    expect(output).toEqual({ result: expectedResult });
  });

  it("-- isn't parsed :: -- == -- && echo yes", async () => {
    testExpr.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await testCommand({
      db: {},
      args: ["--", "==", "--"],
      ctx: { groupId: "g1", cwd: ".", env: { PWD: "/workspace" } },
    });

    expect(testExpr).toHaveBeenCalledWith(
      {},
      ["--", "==", "--"],
      expect.any(Object),
    );
  });

  it("-b :: type_test -b", async () => {
    testExpr.mockResolvedValue({ stdout: "", stderr: "", exitCode: 1 });

    await testCommand({
      db: {},
      args: ["-b", "missing"],
      ctx: { groupId: "g1", cwd: ".", env: { PWD: "/workspace" } },
    });

    expect(testExpr).toHaveBeenCalledWith(
      {},
      ["-b", "missing"],
      expect.any(Object),
    );
  });

  it("-c :: type_test -c", async () => {
    testExpr.mockResolvedValue({ stdout: "", stderr: "", exitCode: 1 });

    await testCommand({
      db: {},
      args: ["-c", "missing"],
      ctx: { groupId: "g1", cwd: ".", env: { PWD: "/workspace" } },
    });

    expect(testExpr).toHaveBeenCalledWith(
      {},
      ["-c", "missing"],
      expect.any(Object),
    );
  });

  it("-d :: type_test -d", async () => {
    testExpr.mockResolvedValue({ stdout: "", stderr: "", exitCode: 1 });

    await testCommand({
      db: {},
      args: ["-d", "missing"],
      ctx: { groupId: "g1", cwd: ".", env: { PWD: "/workspace" } },
    });

    expect(testExpr).toHaveBeenCalledWith(
      {},
      ["-d", "missing"],
      expect.any(Object),
    );
  });

  it("-e :: type_test -e", async () => {
    testExpr.mockResolvedValue({ stdout: "", stderr: "", exitCode: 1 });

    await testCommand({
      db: {},
      args: ["-e", "missing"],
      ctx: { groupId: "g1", cwd: ".", env: { PWD: "/workspace" } },
    });

    expect(testExpr).toHaveBeenCalledWith(
      {},
      ["-e", "missing"],
      expect.any(Object),
    );
  });
});
