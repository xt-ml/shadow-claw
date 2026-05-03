export interface LocalModelRankCandidate {
  id: string;
  supportsTools: boolean;
  contextLength: number;
}

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

export function compareLocalModelCandidates(
  a: LocalModelRankCandidate,
  b: LocalModelRankCandidate,
  providerId: string,
): number {
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
