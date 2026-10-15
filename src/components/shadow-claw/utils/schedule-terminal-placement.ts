import { syncTerminalPlacement } from "./sync-terminal-placement.js";
import { ensureComponentLoaded } from "./load-component.js";

import type { ShadowClawTerminal } from "../../shadow-claw-terminal/shadow-claw-terminal.js";

export function scheduleTerminalPlacement(
  shadow: ShadowRoot | null,
  currentPage: string,
  terminalElement: ShadowClawTerminal | null,
  terminalVisible: boolean,
  terminalPlacementFrame: number | null,
) {
  if (terminalVisible) {
    ensureComponentLoaded("terminal").catch(console.error);
  }
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
