import { exec } from "node:child_process";
import type { HeadlessBashExecutor } from "./bash.js";
import { setHeadlessBashExecutor } from "./bash.js";

/**
 * Native Node.js child_process bash executor for headless CLI / server mode.
 */
export const nativeBashExecutor: HeadlessBashExecutor = ({
  command,
  stdin,
  timeoutSec,
}) => {
  return new Promise<string>((resolve) => {
    const child = exec(
      command,
      { timeout: timeoutSec * 1000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        let output = stdout || "";
        if (stderr) {
          output += (output ? "\n" : "") + stderr;
        }
        if (error && !output) {
          output = error.message;
        }
        resolve(output);
      },
    );
    if (stdin && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
};

// Register with bash tool when loaded
setHeadlessBashExecutor(nativeBashExecutor);
(globalThis as any).__headlessBashExecutor = nativeBashExecutor;
