import type { AppDialogOptions } from "../../../types.js";

export const TRANSFORMERS_JS_CACHE_DIR = "assets/cache/transformers.js";
export const TRANSFORMERS_JS_PROJECT_URL =
  "https://huggingface.co/docs/transformers.js";

export function isTransformersJsResolutionError(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("transformers.js runtime is not installed") ||
    normalized.includes("transformers.js runtime is unavailable") ||
    normalized.includes("no supported transformers.js model loader") ||
    (normalized.includes("cannot find package") &&
      normalized.includes("@huggingface/transformers"))
  );
}

export function buildTransformersJsHelpDialogOptions(
  reason?: string,
): AppDialogOptions {
  const details = [
    `Downloaded model files are stored in ${TRANSFORMERS_JS_CACHE_DIR}.`,
    "On first use the model will be downloaded automatically from HuggingFace. Subsequent requests use the local cache.",
    "If the server reports the runtime is missing, ensure @huggingface/transformers is installed (npm install) and restart the server.",
  ];

  if (reason && reason.trim()) {
    details.push(`Details: ${reason.trim()}`);
  }

  return {
    mode: "info",
    title: "Transformers.js Runtime Issue",
    message:
      "ShadowClaw could not run a Transformers.js model via the local proxy.",
    details,
    confirmLabel: "OK",
    links: [
      {
        label: "Transformers.js docs",
        href: TRANSFORMERS_JS_PROJECT_URL,
      },
    ],
  };
}
