import { executeShell } from "../../../../shell/shell.js";
import { formatShellOutput } from "../../../formatShellOutput.js";

import type { ShadowClawDatabase } from "../../../../db/types";

export async function executeViaShellFallback(
  db: ShadowClawDatabase,
  command: string,
  groupId: string,
  timeoutSec: number,
  allowFullInternetAccess: boolean,
): Promise<string> {
  const shellResult = await executeShell(
    db,
    command,
    groupId,
    {},
    timeoutSec,
    allowFullInternetAccess,
  );

  return formatShellOutput(shellResult);
}