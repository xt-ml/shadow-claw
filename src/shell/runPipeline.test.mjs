import { jest } from "@jest/globals";

jest.unstable_mockModule("./checkTimeout.mjs", () => ({
  checkTimeout: jest.fn(),
}));

jest.unstable_mockModule("./runPipe.mjs", () => ({
  runPipe: jest.fn(),
}));

jest.unstable_mockModule("./runSingle.mjs", () => ({
  runSingle: jest.fn(),
}));

jest.unstable_mockModule("./splitOnOperators.mjs", () => ({
  splitOnOperators: jest.fn(),
}));

const { runPipeline } = await import("./runPipeline.mjs");
const { checkTimeout } = await import("./checkTimeout.mjs");
const { runPipe } = await import("./runPipe.mjs");
const { runSingle } = await import("./runSingle.mjs");
const { splitOnOperators } = await import("./splitOnOperators.mjs");

describe("runPipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("runs piped command via runPipe", async () => {
    splitOnOperators.mockReturnValue([{ cmd: "echo a | cat", op: "" }]);
    runPipe.mockResolvedValue({ stdout: "a", stderr: "", exitCode: 0 });

    await expect(runPipeline({}, "line", {})).resolves.toEqual({
      stdout: "a",
      stderr: "",
      exitCode: 0,
    });

    expect(runPipe).toHaveBeenCalledWith({}, "echo a | cat", {});

    expect(checkTimeout).toHaveBeenCalled();
  });

  it("stops on && failure", async () => {
    splitOnOperators.mockReturnValue([
      { cmd: "a", op: "&&" },
      { cmd: "b", op: "" },
    ]);

    runSingle.mockResolvedValue({ stdout: "", stderr: "err", exitCode: 1 });

    const result = await runPipeline({}, "line", {});

    expect(result.exitCode).toBe(1);

    expect(runSingle).toHaveBeenCalledTimes(1);
  });
});
