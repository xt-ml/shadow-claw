import type { AppDialogOptions } from "../../../ui/types.js";

export async function requestDialog(
  doc: Document,
  shadow: ShadowRoot | null,
  options: AppDialogOptions,
) {
  if (!shadow) {
    return false;
  }

  const dialog = shadow.querySelector(
    ".app-dialog",
  ) as HTMLDialogElement | null;
  const titleEl = shadow.querySelector(
    ".app-dialog__title",
  ) as HTMLElement | null;
  const messageEl = shadow.querySelector(
    ".app-dialog__message",
  ) as HTMLElement | null;
  const detailsEl = shadow.querySelector(
    ".app-dialog__details",
  ) as HTMLUListElement | null;
  const linksEl = shadow.querySelector(
    ".app-dialog__links",
  ) as HTMLDivElement | null;
  const confirmBtn = shadow.querySelector(
    ".app-dialog__btn--confirm",
  ) as HTMLButtonElement | null;
  const cancelBtn = shadow.querySelector(
    ".app-dialog__btn--cancel",
  ) as HTMLButtonElement | null;
  const countdownEl = shadow.querySelector(
    ".app-dialog__countdown",
  ) as HTMLElement | null;

  if (
    !dialog ||
    !titleEl ||
    !messageEl ||
    !detailsEl ||
    !linksEl ||
    !confirmBtn ||
    !cancelBtn
  ) {
    return false;
  }

  if ((dialog as any)._autoCloseTimer) {
    clearInterval((dialog as any)._autoCloseTimer);
    (dialog as any)._autoCloseTimer = null;
  }

  if (dialog.open) {
    dialog.close();
  }

  titleEl.textContent = options.title;
  messageEl.textContent = options.message;

  detailsEl.replaceChildren();
  linksEl.replaceChildren();

  const details = Array.isArray(options.details) ? options.details : [];
  detailsEl.hidden = details.length === 0;
  for (const detail of details) {
    const item = doc.createElement("li");
    item.textContent = detail;

    detailsEl.appendChild(item);
  }

  const links = Array.isArray(options.links) ? options.links : [];
  linksEl.hidden = links.length === 0;
  for (const link of links) {
    const anchor = doc.createElement("a");
    anchor.className = "app-dialog__link";
    anchor.href = link.href;
    anchor.rel = "noreferrer";
    anchor.target = "_blank";
    anchor.textContent = link.label;

    linksEl.appendChild(anchor);
  }

  const mode = options.mode || "confirm";
  const baseConfirmLabel =
    options.confirmLabel || (mode === "info" ? "OK" : "Confirm");
  cancelBtn.textContent = options.cancelLabel || "Cancel";
  cancelBtn.hidden = mode === "info";

  let autoCloseTimer: ReturnType<typeof setInterval> | null = null;
  const cleanupTimer = () => {
    if (autoCloseTimer) {
      clearInterval(autoCloseTimer);
      autoCloseTimer = null;
    }
    if ((dialog as any)._autoCloseTimer) {
      (dialog as any)._autoCloseTimer = null;
    }
  };

  if (
    typeof options.autoCloseSeconds === "number" &&
    options.autoCloseSeconds > 0
  ) {
    let remainingSeconds = Math.max(1, Math.round(options.autoCloseSeconds));
    confirmBtn.textContent = `${baseConfirmLabel} (${remainingSeconds}s)`;

    if (countdownEl) {
      countdownEl.hidden = false;
      countdownEl.textContent = `Auto-closing in ${remainingSeconds}s...`;
      countdownEl.setAttribute("role", "status");
      countdownEl.setAttribute("aria-live", "polite");
      countdownEl.setAttribute("aria-atomic", "true");
    }

    autoCloseTimer = setInterval(() => {
      remainingSeconds--;
      if (remainingSeconds > 0) {
        confirmBtn.textContent = `${baseConfirmLabel} (${remainingSeconds}s)`;
        if (countdownEl) {
          countdownEl.textContent = `Auto-closing in ${remainingSeconds}s...`;
        }
      } else {
        cleanupTimer();
        dialog.returnValue = mode === "info" ? "confirm" : "cancel";
        dialog.close(dialog.returnValue);
      }
    }, 1000);
    (dialog as any)._autoCloseTimer = autoCloseTimer;
  } else {
    confirmBtn.textContent = baseConfirmLabel;
    if (countdownEl) {
      countdownEl.hidden = true;
      countdownEl.textContent = "";
    }
  }

  dialog.returnValue = "";

  return await new Promise<boolean>((resolve) => {
    const onClose = () => {
      cleanupTimer();
      dialog.removeEventListener("close", onClose);
      resolve(dialog.returnValue === "confirm");
    };

    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}
