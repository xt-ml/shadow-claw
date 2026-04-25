/**
 * Format shell execution result into a string
 */
export function formatShellOutput(shellResult: {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}): string {
  let shellOutput = shellResult.stdout || "";
  if (shellResult.stderr) {
    shellOutput += (shellOutput ? "\n" : "") + shellResult.stderr;
  }

  if (shellResult.exitCode !== 0 && !shellOutput) {
    shellOutput = `[exit code: ${shellResult.exitCode}]`;
  }

  return shellOutput || "(no output)";
}
