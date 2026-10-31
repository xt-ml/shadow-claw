export function getLanguageModelApi(): {
  availability: Function;
  create: Function;
} | null {
  const candidate = (globalThis as any).LanguageModel;
  if (!candidate || typeof candidate !== "function") {
    return null;
  }

  if (
    typeof candidate.availability !== "function" ||
    typeof candidate.create !== "function"
  ) {
    return null;
  }

  return candidate;
}

/**
 * Lightweight feature detection for the browser Prompt API.
 */
export function isPromptApiSupported(): boolean {
  return !!getLanguageModelApi();
}
