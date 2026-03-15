import { yesCommand } from "./yes.mjs";

function ok(stdout) {
  return { stdout, stderr: "", exitCode: 0 };
}

describe("yesCommand", () => {
  it("defaults to 'y' when no argument is provided", async () => {
    const output = await yesCommand({ args: [], ok });

    expect(output.result.stdout).toBe(`${"y\n".repeat(100)}`);

    expect(output.result.exitCode).toBe(0);
  });

  it("repeats the provided word 100 times", async () => {
    const output = await yesCommand({ args: ["hello"], ok });

    expect(output.result.stdout).toBe(`${"hello\n".repeat(100)}`);

    expect(output.result.exitCode).toBe(0);
  });
});
