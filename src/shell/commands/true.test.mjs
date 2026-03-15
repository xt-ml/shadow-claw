import { trueCommand } from "./true.mjs";

function ok(stdout) {
  return { stdout, stderr: "", exitCode: 0 };
}

describe("trueCommand", () => {
  it("returns success with no output", async () => {
    const output = await trueCommand({ ok });

    expect(output).toEqual({ result: ok("") });
  });
});
