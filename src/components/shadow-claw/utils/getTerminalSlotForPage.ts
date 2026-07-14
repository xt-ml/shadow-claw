export function getTerminalSlotForPage(shadow, page: string): HTMLElement | null {
    if (!shadow || !["chat", "tasks", "files"].includes(page)) {
      return null;
    }

    const pageEl = shadow.querySelector(`[data-page-id="${page}"]`);
    if (!(pageEl instanceof HTMLElement)) {
      return null;
    }

    const child = pageEl.querySelector(
      "shadow-claw-chat, shadow-claw-tasks, shadow-claw-files",
    );

    const slot =
      child instanceof HTMLElement
        ? child.shadowRoot?.querySelector("[data-terminal-slot]")
        : null;

    return slot instanceof HTMLElement ? slot : null;
  }
