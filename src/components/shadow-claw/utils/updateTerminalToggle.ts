export function updateTerminalToggle(
  shadow: ShadowRoot | null,
  currentPage: string,
  terminalVisible: boolean,
  vmStatus: { ready: boolean; booting: boolean; bootAttempted: boolean },
): void {
  if (!shadow) {
    return;
  }

  const button = shadow.querySelector(".webvm-toggle");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const available = currentPage === "chat" || currentPage === "files";

  button.hidden = !available;
  button.classList.toggle("hidden", !available);
  button.classList.remove(
    "webvm-toggle--hidden",
    "webvm-toggle--visible",
    "webvm-toggle--booting",
    "webvm-toggle--ready",
    "webvm-toggle--error",
  );

  if (!available) {
    button.classList.add("webvm-toggle--error");

    return;
  }

  button.classList.add(
    terminalVisible ? "webvm-toggle--visible" : "webvm-toggle--hidden",
  );

  if (vmStatus.ready) {
    button.classList.add("webvm-toggle--ready");
  } else if (vmStatus.booting || vmStatus.bootAttempted) {
    button.classList.add("webvm-toggle--booting");
  }

  button.setAttribute(
    "aria-label",
    terminalVisible ? "Hide WebVM terminal" : "Show WebVM terminal",
  );

  button.setAttribute(
    "title",
    terminalVisible ? "Hide WebVM terminal" : "Show WebVM terminal",
  );

  button.setAttribute("aria-pressed", String(terminalVisible));
}
