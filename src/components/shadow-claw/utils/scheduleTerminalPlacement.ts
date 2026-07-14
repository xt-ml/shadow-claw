import { syncTerminalPlacement } from "./syncTerminalPlacement.js";

import type { ShadowClawTerminal } from "../../shadow-claw-terminal/shadow-claw-terminal.js";

export function scheduleTerminalPlacement(
  shadow: ShadowRoot | null,
  currentPage: string,
  terminalElement: ShadowClawTerminal | null,
  terminalVisible: boolean,
  terminalPlacementFrame: number | null,
) {
  if (terminalPlacementFrame !== null) {
    cancelAnimationFrame(terminalPlacementFrame);
  }

  terminalPlacementFrame = requestAnimationFrame(() => {
    terminalPlacementFrame = null;
    syncTerminalPlacement(
      shadow,
      currentPage,
      terminalElement,
      terminalVisible,
    );
  });
}
