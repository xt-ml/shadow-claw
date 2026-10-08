/**
 * Adaptive thinking inference and capability resolution for AWS Bedrock models.
 */

export const ADAPTIVE_THINKING_CAPABILITY_BY_MODEL_ID = new Map<
  string,
  boolean
>();

export function inferAdaptiveThinkingCapability(
  value: unknown,
): boolean | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const id = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (
    id.includes("claude-sonnet-5") ||
    id.includes("claude-opus-4-7") ||
    id.includes("claude-opus-5") ||
    id.includes("claude-opus-4-8") ||
    id.includes("claude-mythos-5") ||
    id.includes("claude-mythos") ||
    id.includes("claude-fable-5") ||
    id.includes("claude-fable")
  ) {
    return true;
  }

  if (id.includes("claude-sonnet-4-6")) {
    return false;
  }

  return undefined;
}

export function cacheAdaptiveThinkingCapability(
  modelId: unknown,
  modelName?: unknown,
): void {
  if (typeof modelId !== "string" || modelId.trim().length === 0) {
    return;
  }

  const byId = inferAdaptiveThinkingCapability(modelId);
  const byName = inferAdaptiveThinkingCapability(modelName);
  const inferred = byName ?? byId;

  if (typeof inferred === "boolean") {
    ADAPTIVE_THINKING_CAPABILITY_BY_MODEL_ID.set(
      modelId.toLowerCase(),
      inferred,
    );
  }
}

export function supportsAdaptiveThinking(
  modelId: string,
  resolvedModelId: string,
): boolean {
  const raw = modelId.toLowerCase();
  const resolved = resolvedModelId.toLowerCase();

  if (ADAPTIVE_THINKING_CAPABILITY_BY_MODEL_ID.has(raw)) {
    return ADAPTIVE_THINKING_CAPABILITY_BY_MODEL_ID.get(raw) === true;
  }

  if (ADAPTIVE_THINKING_CAPABILITY_BY_MODEL_ID.has(resolved)) {
    return ADAPTIVE_THINKING_CAPABILITY_BY_MODEL_ID.get(resolved) === true;
  }

  const inferredRaw = inferAdaptiveThinkingCapability(raw);
  if (typeof inferredRaw === "boolean") {
    return inferredRaw;
  }

  const inferredResolved = inferAdaptiveThinkingCapability(resolved);
  if (typeof inferredResolved === "boolean") {
    return inferredResolved;
  }

  return false;
}
