import { falseCommand } from "./false.mjs";

function fail(stderr, code = 1) {
  return { stdout: "", stderr, exitCode: code };
}

describe("falseCommand", () => {
  it("returns exit code 1 with no output", async () => {
    const output = await falseCommand({ fail });

    expect(output).toEqual({ result: fail("", 1) });
  });
});
