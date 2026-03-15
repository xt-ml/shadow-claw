import { printenvCommand } from "./printenv.mjs";

function ok(stdout) {
  return { stdout, stderr: "", exitCode: 0 };
}

describe("printenvCommand", () => {
  it("delegates to env formatting", async () => {
    const output = await printenvCommand({
      ctx: {
        cwd: ".",
        env: {
          PWD: "/workspace",
          HOME: "/workspace/home",
          USER: "shadow",
        },
      },
      ok,
    });

    expect(output.result.exitCode).toBe(0);

    expect(output.result.stderr).toBe("");

    expect(output.result.stdout).toContain("PWD=/workspace\n");

    expect(output.result.stdout).toContain("HOME=/workspace/home\n");

    expect(output.result.stdout).toContain("USER=shadow\n");
  });
});
