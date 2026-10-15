import { scheduleTerminalPlacement } from "./schedule-terminal-placement.js";
import { updateTerminalToggle } from "./update-terminal-toggle.js";

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
