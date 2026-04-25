import { formatShellOutput } from "./formatShellOutput.js";

describe("formatShellOutput", () => {
  it("combines stdout and stderr", () => {
    expect(formatShellOutput({ stdout: "o", stderr: "e", exitCode: 1 })).toBe(
      "o\ne",
    );
  });

  it("falls back to exit code message", () => {
    expect(formatShellOutput({ stdout: "", stderr: "", exitCode: 2 })).toBe(
      "[exit code: 2]",
    );
  });
});
