import { Bash } from "just-bash";
import { createFileSystem } from "./fs.js";
import type { ShadowClawDatabase } from "../db/types.js";

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
  allowFullInternetAccess: boolean = false,
): Promise<ShellResult> {
  try {
    const fs = await createFileSystem(db, groupId);
    const bash = new Bash({
      fs,
      // https://github.com/vercel-labs/just-bash?tab=readme-ov-file#network-access
      network: {
        dangerouslyAllowFullInternetAccess: allowFullInternetAccess,
        // Explicitly control this so true/false behaves deterministically in browser bundles.
        denyPrivateRanges: !allowFullInternetAccess,
      },
    });

    const controller =
      Number.isFinite(timeoutSec) && timeoutSec > 0
        ? new AbortController()
        : undefined;
    const timer = controller
      ? setTimeout(() => {
          controller.abort(new Error(`Command timed out after ${timeoutSec}s`));
        }, timeoutSec * 1000)
      : undefined;
    (timer as any)?.unref?.();

    let result;
    try {
      result = await bash.exec(command, {
        env: {
          HOME: "/home/user",
          PATH: "/usr/bin:/bin",
          PWD: "/home/user",
          ...env,
        },
        ...(controller ? { signal: controller.signal } : {}),
      });
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }

    if (controller?.signal.aborted && (result.exitCode ?? 0) === 0) {
      return {
        stdout: result.stdout || "",
        stderr:
          result.stderr || `Command timed out after ${timeoutSec} seconds`,
        exitCode: 124,
      };
    }

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
