import type { LocalModelRankCandidate } from "../../types.js";
import { PROVIDERS } from "../../../config/config.js";
import { escapeHtml } from "../../../utils/html.js";

function parseModelBillionsFromId(modelId: string): number | null {
  const normalized = modelId.toLowerCase();
  const directMatch = /(?:^|[-_\/.])(\d+(?:\.\d+)?)b(?:[-_\/.]|$)/i.exec(
    normalized,
  );
  if (directMatch) {
    const parsed = Number(directMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // Gemma style IDs such as E2B/E4B.
  const effectiveMatch = /(?:^|[-_\/.])e(\d+(?:\.\d+)?)b(?:[-_\/.]|$)/i.exec(
    normalized,
  );
  if (!effectiveMatch) {
    return null;
  }

  const parsed = Number(effectiveMatch[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function isLikelyInstructionModelId(modelId: string): boolean {
  const id = modelId.toLowerCase();

  if (/(^|[-_./])(instruct|chat|assistant|tool|it)([-_./]|$)/i.test(id)) {
    return true;
  }

  // Local catalogs commonly use Qwen* and distilled R1 variants as instruct defaults.
  if (/(qwen\d*(?:\.\d+)?|deepseek-r1-distill)/i.test(id)) {
    return true;
  }

  return false;
}

function hasQuantizedHint(modelId: string): boolean {
  return /(^|[-_./])(q\d+|int8|uint8|4bit|8bit|bnb4|opt)([-_./]|$)/i.test(
    modelId,
  );
}

function getLocalModelSortScore(
  candidate: LocalModelRankCandidate,
  providerId: string,
): number {
  const idLower = candidate.id.toLowerCase();
  const sizeB = parseModelBillionsFromId(candidate.id);
  let score = 0;

  if (!candidate.supportsTools) {
    score += 60;
  }

  if (isLikelyInstructionModelId(candidate.id)) {
    score -= 40;
  }

  if (idLower.includes("onnx")) {
    score -= 30;
  } else {
    score += 90;
  }

  if (hasQuantizedHint(idLower)) {
    score -= 20;
  }

  if (sizeB === null) {
    score += 10;
  } else if (sizeB <= 0.6) {
    score -= 120;
  } else if (sizeB <= 0.8) {
    score -= 100;
  } else if (sizeB <= 1.2) {
    score -= 80;
  } else if (sizeB <= 1.8) {
    score -= 40;
  } else if (sizeB <= 3) {
    score += 20;
  } else {
    score += 80;
  }

  if (/thinking|reasoning/i.test(idLower)) {
    score += 25;
  }

  // Browser runtime has the strictest memory pressure profile.
  if (providerId === "transformers_js_browser") {
    if (sizeB !== null && sizeB > 1.5) {
      score += 40;
    }

    if (!idLower.includes("onnx")) {
      score += 80;
    }
  }

  return score;
}

export const ORIGINAL_PROMPT_API_MODELS: readonly string[] = [
  "onnx-community/Qwen3-0.6B-ONNX",
  "onnx-community/gemma-3-1b-it-ONNX-GQA",
  "onnx-community/gemma-4-E2B-it-ONNX",
  "onnx-community/gemma-4-E4B-it-ONNX",
];

export const CURATED_PROMPT_API_MODEL_LABELS: Record<string, string> = {
  "onnx-community/Qwen3-0.6B-ONNX":
    "onnx-community/Qwen3-0.6B-ONNX — Recommended (Fast, Compact & Tool Calling)",
  "onnx-community/gemma-3-1b-it-ONNX-GQA":
    "onnx-community/gemma-3-1b-it-ONNX-GQA — Alternative (1B Parameters)",
  "onnx-community/gemma-4-E2B-it-ONNX":
    "onnx-community/gemma-4-E2B-it-ONNX — Alternative (2B Parameters, 128k Context)",
  "onnx-community/gemma-4-E4B-it-ONNX":
    "onnx-community/gemma-4-E4B-it-ONNX — Alternative (4B Parameters, 128k Context)",
};

export function compareLocalModelCandidates(
  a: LocalModelRankCandidate,
  b: LocalModelRankCandidate,
  providerId: string,
): number {
  if (providerId === "transformers_js_browser") {
    const idxA = ORIGINAL_PROMPT_API_MODELS.indexOf(a.id);
    const idxB = ORIGINAL_PROMPT_API_MODELS.indexOf(b.id);

    if (idxA !== -1 && idxB !== -1) {
      return idxA - idxB;
    }
    if (idxA !== -1) {
      return -1;
    }
    if (idxB !== -1) {
      return 1;
    }

    return a.id.localeCompare(b.id);
  }

  const scoreA = getLocalModelSortScore(a, providerId);
  const scoreB = getLocalModelSortScore(b, providerId);

  if (scoreA !== scoreB) {
    return scoreA - scoreB;
  }

  if (a.contextLength !== b.contextLength) {
    return b.contextLength - a.contextLength;
  }

  return a.id.localeCompare(b.id);
}

export function getSortedTransformersJsBrowserModelIds(
  modelItems?: Array<string | { id?: string; name?: string }>,
): string[] {
  const staticModels = PROVIDERS.transformers_js_browser?.models || [];
  const rawItems =
    modelItems && modelItems.length > 0 ? modelItems : staticModels;

  const idSet = new Set<string>();
  for (const item of rawItems) {
    const id = typeof item === "string" ? item : item?.id || item?.name;
    if (id && typeof id === "string" && id.trim()) {
      idSet.add(id.trim());
    }
  }
  for (const id of ORIGINAL_PROMPT_API_MODELS) {
    idSet.add(id);
  }
  for (const id of staticModels) {
    idSet.add(id);
  }

  const allIds = Array.from(idSet);
  return allIds.sort((a, b) =>
    compareLocalModelCandidates(
      { id: a, supportsTools: isLikelyInstructionModelId(a), contextLength: 0 },
      { id: b, supportsTools: isLikelyInstructionModelId(b), contextLength: 0 },
      "transformers_js_browser",
    ),
  );
}

export function renderTransformersJsBrowserModelOptions(
  selectedModel: string,
  modelItems?: Array<string | { id?: string; name?: string }>,
  options?: { includeCustom?: boolean },
): string {
  const sortedModelIds = getSortedTransformersJsBrowserModelIds(modelItems);
  let html = "";
  for (let i = 0; i < sortedModelIds.length; i++) {
    const id = sortedModelIds[i];
    const isSelected = id === selectedModel ? " selected" : "";
    const label =
      CURATED_PROMPT_API_MODEL_LABELS[id] ||
      `${id}${isLikelyInstructionModelId(id) ? " 🛠️" : ""}`;
    html += `<option value="${escapeHtml(id)}"${isSelected}>${escapeHtml(label)}</option>`;
    if (i === 3 && sortedModelIds.length > 4) {
      html += "<hr>";
    }
  }
  if (options?.includeCustom) {
    const isCustomSelected =
      selectedModel === "__custom__" ||
      (selectedModel !== "" && !sortedModelIds.includes(selectedModel))
        ? " selected"
        : "";
    html += `<option value="__custom__"${isCustomSelected}>-- Custom Model ID --</option>`;
  }
  return html;
}
