import { scheduleTerminalPlacement } from "./scheduleTerminalPlacement.js";
import { updateTerminalToggle } from "./updateTerminalToggle.js";

import type { ShadowClaw } from "../shadow-claw.js";

export function toggleTerminalVisibility(
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
) {
  shadowClaw.terminalVisible = !shadowClaw.terminalVisible;

  updateTerminalToggle(
    shadow,
    shadowClaw.currentPage,
    shadowClaw.terminalVisible,
    shadowClaw.vmStatus,
  );

  scheduleTerminalPlacement(
    shadow,
    shadowClaw.currentPage,
    shadowClaw.terminalElement,
    shadowClaw.terminalVisible,
    shadowClaw.terminalPlacementFrame,
  );
}
