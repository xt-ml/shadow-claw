import { showWarning } from "../../../ui/toast.js";

export interface RequestConfirmationOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * Requests user confirmation via host app shell dialog or fallback toast warning.
 */
export async function requestConfirmation(
  options: RequestConfirmationOptions,
  appShell: any = typeof document !== "undefined"
    ? document.querySelector("shadow-claw")
    : null,
  showWarningFn: typeof showWarning = showWarning,
): Promise<boolean> {
  if (appShell && typeof appShell.requestDialog === "function") {
    return await appShell.requestDialog({ mode: "confirm", ...options });
  }

  showWarningFn(options.message, 4500);
  return false;
}
