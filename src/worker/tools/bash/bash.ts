import {
  BASH_DEFAULT_TIMEOUT_SEC,
  BASH_MAX_TIMEOUT_SEC,
  CONFIG_KEYS,
} from "../../../config/config.js";

import { getConfig } from "../../../db/getConfig.js";
import { ShadowClawDatabase } from "../../../db/types.js";

import {
  bootVM,
  executeInVM,
  getVMBootModePreference,
  getVMStatus,
  isVMReady,
} from "../../../shell/vm.js";

import { post } from "../../utils/post.js";
import { executeViaShellFallback } from "./utils/executeViaShellFallback.js";
import { getAllowFullInternetAccess } from "./utils/getAllowFullInternetAccess.js";
import { waitForVMReady } from "./utils/waitForVMReady.js";

import { writeGroupFile } from "../../../storage/writeGroupFile.js";
import { deleteGroupFile } from "../../../storage/deleteGroupFile.js";

export async function executeBash(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  const configuredTimeoutRaw = await getConfig(
    db,
    CONFIG_KEYS.VM_BASH_TIMEOUT_SEC,
  );

  const configuredTimeout = Number(configuredTimeoutRaw);
  const defaultTimeoutSec = Number.isFinite(configuredTimeout)
    ? Math.min(Math.max(configuredTimeout, 1), BASH_MAX_TIMEOUT_SEC)
    : BASH_DEFAULT_TIMEOUT_SEC;

  const requestedTimeout = Number(input.timeout);
  const timeoutSec = Number.isFinite(requestedTimeout)
    ? Math.min(Math.max(requestedTimeout, 1), BASH_MAX_TIMEOUT_SEC)
    : defaultTimeoutSec;

  const allowFullInternetAccess = await getAllowFullInternetAccess(db);

  const bootMode = getVMBootModePreference();
  const stdin = input.stdin ? String(input.stdin) : "";
  const hasStdin = stdin.length > 0;
  const stdinFile = ".shadowclaw_stdin";

  let command = input.command;
  if (hasStdin) {
    if (bootMode === "ext2") {
      const eofMarker = `EOF_SC_${Date.now()}`;
      command = `(cat << '${eofMarker}'\n${stdin}\n${eofMarker}\n) | (${command})`;
    } else {
      command = `{\n${command}\n} < /home/user/${stdinFile}; _code=$?; rm -f /home/user/${stdinFile}; exit $_code`;
    }
  }

  try {
    if (hasStdin && bootMode !== "ext2") {
      await writeGroupFile(db, groupId, stdinFile, stdin);
    }

    // Explicit disabled mode means "always use JS shell emulator".
    if (bootMode === "disabled") {
      return await executeViaShellFallback(
        db,
        command,
        groupId,
        timeoutSec,
        allowFullInternetAccess,
      );
    }

    if (!isVMReady()) {
      await bootVM();
      const status = getVMStatus();

      // Give the eager boot path a chance to finish before returning an error.
      if (!isVMReady() && status.booting) {
        await waitForVMReady(Math.min(timeoutSec * 1000, 30_000));
      }
    }

    if (isVMReady()) {
      return await executeInVM(command, timeoutSec, { db, groupId });
    }

    const status = getVMStatus();
    const reason = status.error
      ? `Reason: ${status.error}`
      : status.booting
        ? "Reason: WebVM is still booting."
        : "Reason: WebVM is unavailable.";

    post({
      type: "show-toast",
      payload: {
        duration: 7000,
        message:
          `WebVM unavailable for this bash command. ${reason} ` +
          "Falling back to JavaScript Bash Emulator and retrying WebVM on the next command.",
        type: "warning",
      },
    });

    return await executeViaShellFallback(
      db,
      command,
      groupId,
      timeoutSec,
      allowFullInternetAccess,
    );
  } finally {
    if (hasStdin && bootMode !== "ext2") {
      await deleteGroupFile(db, groupId, stdinFile).catch(() => {});
    }
  }
}
