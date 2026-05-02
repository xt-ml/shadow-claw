import { modelRegistry } from "./model-registry.js";

export type AttachmentCategory =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "file";

export interface ModelAttachmentCapabilities {
  images: boolean;
  audio: boolean;
  video: boolean;
  documents: boolean;
  routerByFeatures: boolean;
  source: "metadata" | "heuristic" | "unknown";
}

export function getAttachmentCategory(
  mimeType = "",
  fileName = "",
): AttachmentCategory {
  const normalizedMime = mimeType.toLowerCase();
  const normalizedName = fileName.toLowerCase();

  if (
    normalizedMime.startsWith("text/") ||
    normalizedMime.includes("json") ||
    normalizedMime.includes("xml") ||
    normalizedName.endsWith(".md") ||
    normalizedName.endsWith(".txt")
  ) {
    return "text";
  }

  if (normalizedMime.startsWith("image/")) {
    return "image";
  }

  if (normalizedMime.startsWith("audio/")) {
    return "audio";
  }

  if (normalizedMime.startsWith("video/")) {
    return "video";
  }

  if (normalizedMime === "application/pdf" || normalizedName.endsWith(".pdf")) {
    return "document";
  }

  return "file";
}

export function getModelAttachmentCapabilities(
  modelId: string,
): ModelAttachmentCapabilities {
  const normalizedModelId = (modelId || "").toLowerCase();
  const modelInfo = modelRegistry.getModelInfo(normalizedModelId);

  if (modelInfo) {
    const images =
      modelInfo.supportsImageInput === true ||
      modelInfo.routesByRequestFeatures === true;
    const audio =
      modelInfo.supportsAudioInput === true ||
      modelInfo.routesByRequestFeatures === true;
    const video =
      modelInfo.supportsVideoInput === true ||
      modelInfo.routesByRequestFeatures === true;
    const documents =
      modelInfo.supportsDocumentInput === true ||
      modelInfo.routesByRequestFeatures === true;

    if (
      modelInfo.supportsImageInput !== undefined ||
      modelInfo.supportsAudioInput !== undefined ||
      modelInfo.supportsVideoInput !== undefined ||
      modelInfo.supportsDocumentInput !== undefined ||
      modelInfo.routesByRequestFeatures
    ) {
      return {
        images,
        audio,
        video,
        documents,
        routerByFeatures: !!modelInfo.routesByRequestFeatures,
        source: "metadata",
      };
    }
  }

  const multimodalPatterns = [
    "gpt-4o",
    "gpt-4.1",
    "claude-3",
    "claude-4",
    // Claude 4-family uses "claude-<name>-<version>" (e.g. claude-sonnet-4)
    "claude-sonnet",
    "claude-haiku",
    "claude-opus",
    "gemini",
    "llava",
    "qwen-vl",
    "pixtral",
  ];
  const heuristicMatch = multimodalPatterns.some((pattern) =>
    normalizedModelId.includes(pattern),
  );

  // Claude 3.5+, 3.7+, and Claude 4 family all support PDFs natively via Anthropic's
  // document content block. Claude 4 models follow the "claude-<name>-4" naming pattern
  // (e.g. "claude-sonnet-4", "claude-haiku-4") in addition to "claude-4-*" variants.
  const supportsDocuments =
    normalizedModelId.includes("claude-3-5") ||
    normalizedModelId.includes("claude-3.5") ||
    normalizedModelId.includes("claude-3-7") ||
    normalizedModelId.includes("claude-3.7") ||
    normalizedModelId.includes("claude-4") ||
    /claude-(?:sonnet|haiku|opus)-\d/.test(normalizedModelId);

  if (heuristicMatch) {
    return {
      images: true,
      audio:
        normalizedModelId.includes("omni") ||
        normalizedModelId.includes("audio"),
      video:
        normalizedModelId.includes("omni") ||
        normalizedModelId.includes("video"),
      documents: supportsDocuments,
      routerByFeatures: normalizedModelId === "openrouter/free",
      source: "heuristic",
    };
  }

  return {
    images: false,
    audio: false,
    video: false,
    documents: false,
    routerByFeatures: normalizedModelId === "openrouter/free",
    source: "unknown",
  };
}

export function formatModelAttachmentCapabilitySummary(
  modelId: string,
): string {
  const capabilities = getModelAttachmentCapabilities(modelId);
  const parts = [
    capabilities.images ? "images native" : "images fallback",
    capabilities.audio ? "audio native" : "audio fallback",
    capabilities.video ? "video native" : "video fallback",
    capabilities.documents ? "PDFs native" : "PDFs fallback",
  ];

  if (capabilities.routerByFeatures) {
    parts.push("router can adapt by request features");
  }

  return parts.join(" · ");
}
