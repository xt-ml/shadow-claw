import { getModelMaxTokens } from "../../../../config/config.js";

export type BrowserNavigator = Navigator & {
  deviceMemory?: number;
};

export function getRecommendedMaxTokens(
  providerId: string,
  modelId: string,
): {
  recommended: number;
  detail: string;
} {
  const modelCeiling = getModelMaxTokens(modelId);
  const browserNavigator: BrowserNavigator | null =
    typeof navigator === "undefined" ? null : (navigator as BrowserNavigator);
  const deviceMemory =
    typeof browserNavigator?.deviceMemory === "number"
      ? browserNavigator.deviceMemory
      : null;
  const cpuThreads =
    typeof browserNavigator?.hardwareConcurrency === "number"
      ? browserNavigator.hardwareConcurrency
      : null;

  if (providerId !== "ollama") {
    return {
      recommended: modelCeiling,
      detail: `Model-aware ceiling: ${modelCeiling.toLocaleString()} tokens.`,
    };
  }

  let recommended = modelCeiling;

  if (deviceMemory !== null) {
    if (deviceMemory >= 32) {
      recommended = Math.min(recommended, 16384);
    } else if (deviceMemory >= 16) {
      recommended = Math.min(recommended, 8192);
    } else if (deviceMemory >= 8) {
      recommended = Math.min(recommended, 4096);
    } else {
      recommended = Math.min(recommended, 2048);
    }
  }

  if (cpuThreads !== null) {
    if (cpuThreads <= 4) {
      recommended = Math.min(recommended, 2048);
    } else if (cpuThreads >= 16) {
      recommended = Math.min(modelCeiling, Math.max(recommended, 8192));
    } else if (cpuThreads >= 8) {
      recommended = Math.min(modelCeiling, Math.max(recommended, 4096));
    }
  }

  if (/thinking|reasoning/i.test(modelId)) {
    recommended = Math.min(recommended, 4096);
  }

  recommended = Math.max(512, Math.min(recommended, modelCeiling));

  const hints: string[] = [];
  if (deviceMemory !== null) {
    hints.push(`${deviceMemory} GB browser-reported memory`);
  }

  if (cpuThreads !== null) {
    hints.push(`${cpuThreads} CPU threads`);
  }

  if (/thinking|reasoning/i.test(modelId)) {
    hints.push("reasoning model");
  }

  return {
    recommended,
    detail:
      hints.length > 0
        ? `Recommended for this device: ${recommended.toLocaleString()} tokens (${hints.join(", ")}). Model ceiling: ${modelCeiling.toLocaleString()}.`
        : `Recommended for local inference: ${recommended.toLocaleString()} tokens. Model ceiling: ${modelCeiling.toLocaleString()}.`,
  };
}
