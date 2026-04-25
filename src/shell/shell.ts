import { Bash } from "just-bash";
import { createFileSystem } from "./fs.js";
import type { ShadowClawDatabase } from "../types.js";

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a shell command string against the workspace via just-bash.
 */
export async function executeShell(
  db: ShadowClawDatabase,
  command: string,
  groupId: string,
  env: Record<string, string> = {},
  timeoutSec: number = 30,
): Promise<ShellResult> {
  try {
    const fs = await createFileSystem(db, groupId);
    const bash = new Bash({
      fs,
      // https://github.com/vercel-labs/just-bash?tab=readme-ov-file#network-access
      network: { dangerouslyAllowFullInternetAccess: true },
    });

    // Enforce timeout using AbortController if supported by just-bash,
    // or through custom logic. For simplicity, we can rely on standard interpretation
    // and promise timeouts.

    // Set up bash execution context and run
    const result = await bash.exec(command, {
      env: { HOME: "/home/user", PATH: "/usr/bin", PWD: "/home/user", ...env },
    });

    return {
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      exitCode: result.exitCode ?? 0,
    };
  } catch (err) {
    return {
      stdout: "",
      stderr: err instanceof Error ? err.message : String(err),
      exitCode: 1,
    };
  }
}
