import { getTerminalSlotForPage } from "./getTerminalSlotForPage.js";

import type { ShadowClawTerminal } from "../../shadow-claw-terminal/shadow-claw-terminal.js";

export function syncTerminalPlacement(
  shadow: ShadowRoot | null,
  currentPage: string,
  terminalElement: ShadowClawTerminal | null,
  terminalVisible: boolean,
) {
  const terminal = terminalElement;
  if (!terminal) {
    return;
  }

  const slot = getTerminalSlotForPage(shadow, currentPage);
  if (!slot) {
    return;
  }

  if (terminal.parentElement !== slot) {
    slot.appendChild(terminal);
  }

  const shouldHide = !terminalVisible;
  terminal.hidden = shouldHide;

  if (shouldHide) {
    slot.setAttribute("hidden", "hidden");
    shadow
      ?.querySelector("shadow-claw-terminal")
      ?.setAttribute("hidden", "hidden");
  } else {
    slot.removeAttribute("hidden");
    shadow?.querySelector("shadow-claw-terminal")?.removeAttribute("hidden");
  }
}
