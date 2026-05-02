import type { AppDialogOptions } from "../../../types.js";

export const LLAMAFILE_EXPECTED_DIR = "assets/cache/llamafile";
export const LLAMAFILE_PROJECT_URL = "https://github.com/mozilla-ai/llamafile";

export function isLlamafileResolutionError(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("assets/cache/llamafile") ||
    normalized.includes("missing or invalid 'model' parameter for cli mode") ||
    normalized.includes("failed to list llamafile binaries")
  );
}

export function buildLlamafileHelpDialogOptions(
  reason?: string,
): AppDialogOptions {
  const details = [
    `Put one or more *.llamafile files in the ${LLAMAFILE_EXPECTED_DIR} folder.`,
    "Then reopen the model list and select one of the discovered binaries, or enter a custom model id that matches a file name in that directory.",
  ];

  if (reason && reason.trim()) {
    details.push(`Details: ${reason.trim()}`);
  }

  return {
    mode: "info",
    title: "Llamafile Models Needed",
    message: "ShadowClaw could not find a usable llamafile model for CLI mode.",
    details,
    confirmLabel: "OK",
    links: [
      {
        label: "Get llamafile",
        href: LLAMAFILE_PROJECT_URL,
      },
    ],
  };
}
