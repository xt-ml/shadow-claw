import { modelRegistry } from "../subsystems/providers/model-registry.js";
import { getMimeType } from "../utils/mime.js";

export type AttachmentCategory =
  "text" | "image" | "audio" | "video" | "document" | "file";

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
  const resolvedMime =
    mimeType && mimeType !== "application/octet-stream"
      ? mimeType
      : getMimeType(fileName) || mimeType;
  const normalizedMime = resolvedMime.toLowerCase();
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

  const isExplicitlyNonVision =
    normalizedModelId.includes("no-vision") ||
    normalizedModelId.includes("non-vision") ||
    normalizedModelId.includes("text-only");

  const isRouter =
    normalizedModelId === "openrouter/free" ||
    normalizedModelId === "openrouter/auto";

  const multimodalPatterns = [
    "gpt-4o",
    "gpt-4.1",
    "gpt-5",
    "gpt-6",
    "astra",
    "claude-3",
    "claude-4",
    "claude-5",
    // Claude 4-family uses "claude-<name>-<version>" (e.g. claude-sonnet-4)
    "claude-sonnet",
    "claude-haiku",
    "claude-opus",
    "claude-fable",
    "claude-mythos",
    "gemini",
    "omni",
    "llava",
    "qwen-vl",
    "-vl",
    "vision",
    "pixtral",
  ];
  const heuristicMatch =
    !isExplicitlyNonVision &&
    multimodalPatterns.some((pattern) => normalizedModelId.includes(pattern));

  // Claude 3.5+, 3.7+, 4, and 5 families, Gemini, and frontier GPT models (GPT-4.1, GPT-5, GPT-6, Astra)
  // support PDFs/documents natively.
  const supportsDocuments =
    !isExplicitlyNonVision &&
    (normalizedModelId.includes("claude-3-5") ||
      normalizedModelId.includes("claude-3.5") ||
      normalizedModelId.includes("claude-3-7") ||
      normalizedModelId.includes("claude-3.7") ||
      normalizedModelId.includes("claude-4") ||
      normalizedModelId.includes("claude-5") ||
      normalizedModelId.includes("claude-fable") ||
      normalizedModelId.includes("claude-mythos") ||
      normalizedModelId.includes("gemini") ||
      normalizedModelId.includes("gpt-4.1") ||
      normalizedModelId.includes("gpt-5") ||
      normalizedModelId.includes("gpt-6") ||
      normalizedModelId.includes("astra") ||
      /claude-(?:sonnet|haiku|opus|fable|mythos)-\d/.test(normalizedModelId));

  if (heuristicMatch) {
    return {
      images: true,
      audio:
        normalizedModelId.includes("omni") ||
        normalizedModelId.includes("audio"),
      video:
        normalizedModelId.includes("omni") ||
        normalizedModelId.includes("video") ||
        normalizedModelId.includes("gemini"),
      documents: supportsDocuments,
      routerByFeatures: isRouter,
      source: "heuristic",
    };
  }

  return {
    images: false,
    audio: false,
    video: false,
    documents: false,
    routerByFeatures: isRouter,
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
