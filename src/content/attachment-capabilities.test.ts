import {
  getAttachmentCategory,
  getModelAttachmentCapabilities,
} from "./attachment-capabilities.js";
import { modelRegistry } from "../subsystems/providers/model-registry.js";

describe("attachment-capabilities", () => {
  describe("getAttachmentCategory", () => {
    it("returns text for text/plain", () => {
      expect(getAttachmentCategory("text/plain")).toBe("text");
    });

    it("returns text for application/json", () => {
      expect(getAttachmentCategory("application/json")).toBe("text");
    });

    it("returns text for .md extension", () => {
      expect(
        getAttachmentCategory("application/octet-stream", "README.md"),
      ).toBe("text");
    });

    it("returns image for image/png", () => {
      expect(getAttachmentCategory("image/png")).toBe("image");
    });

    it("returns audio for audio/mpeg", () => {
      expect(getAttachmentCategory("audio/mpeg")).toBe("audio");
    });

    it("returns audio for audio/wav", () => {
      expect(getAttachmentCategory("audio/wav")).toBe("audio");
    });

    it("returns video for video/mp4", () => {
      expect(getAttachmentCategory("video/mp4")).toBe("video");
    });

    it("returns document for application/pdf", () => {
      expect(getAttachmentCategory("application/pdf")).toBe("document");
    });

    it("returns document for .pdf file name", () => {
      expect(
        getAttachmentCategory("application/octet-stream", "report.pdf"),
      ).toBe("document");
    });

    it("returns file for unknown binary", () => {
      expect(getAttachmentCategory("application/zip")).toBe("file");
    });

    it("returns image for image file by extension when mimeType empty", () => {
      expect(getAttachmentCategory("", "photo.jpg")).toBe("image");
      expect(getAttachmentCategory("", "photo.png")).toBe("image");
      expect(getAttachmentCategory("", "photo.heic")).toBe("image");
    });

    it("returns video for video file by extension when mimeType empty", () => {
      expect(getAttachmentCategory("", "movie.mp4")).toBe("video");
      expect(getAttachmentCategory("", "clip.mkv")).toBe("video");
    });

    it("returns audio for audio file by extension when mimeType empty", () => {
      expect(getAttachmentCategory("", "song.mp3")).toBe("audio");
      expect(getAttachmentCategory("", "track.flac")).toBe("audio");
    });

    it("returns document for pdf by extension when mimeType empty", () => {
      expect(getAttachmentCategory("", "report.pdf")).toBe("document");
    });
  });

  describe("getModelAttachmentCapabilities", () => {
    afterEach(() => {
      // Clean up any test registrations between tests
      modelRegistry.models.clear();
    });

    it("returns documents=true from registry metadata", () => {
      modelRegistry.registerModelInfo("claude-3-5-sonnet-20241022", {
        contextWindow: 200000,
        maxOutput: null,
        supportsDocumentInput: true,
      });

      const caps = getModelAttachmentCapabilities("claude-3-5-sonnet-20241022");
      expect(caps.documents).toBe(true);
      expect(caps.source).toBe("metadata");
    });

    it("returns documents=false for model without document support in registry", () => {
      modelRegistry.registerModelInfo("gpt-4-turbo", {
        contextWindow: 128000,
        maxOutput: null,
        supportsImageInput: true,
        supportsDocumentInput: false,
      });

      const caps = getModelAttachmentCapabilities("gpt-4-turbo");
      expect(caps.documents).toBe(false);
      expect(caps.source).toBe("metadata");
    });

    it("heuristic: claude-3-5 model gets documents=true", () => {
      const caps = getModelAttachmentCapabilities("claude-3-5-haiku-20241022");
      expect(caps.images).toBe(true);
      expect(caps.documents).toBe(true);
      expect(caps.source).toBe("heuristic");
    });

    it("heuristic: claude-4 model gets documents=true", () => {
      const caps = getModelAttachmentCapabilities("claude-sonnet-4");
      expect(caps.documents).toBe(true);
      expect(caps.source).toBe("heuristic");
    });

    it("heuristic: recognizes Claude Fable and Mythos as multimodal with document support", () => {
      const fableCaps = getModelAttachmentCapabilities("claude-fable-5");
      expect(fableCaps.images).toBe(true);
      expect(fableCaps.documents).toBe(true);
      expect(fableCaps.source).toBe("heuristic");

      const mythosCaps = getModelAttachmentCapabilities("claude-mythos-5");
      expect(mythosCaps.images).toBe(true);
      expect(mythosCaps.documents).toBe(true);
      expect(mythosCaps.source).toBe("heuristic");
    });

    it("heuristic: recognizes GPT-6 Astra and GPT-5 as multimodal with document support", () => {
      const astraCaps = getModelAttachmentCapabilities("gpt-6-astra");
      expect(astraCaps.images).toBe(true);
      expect(astraCaps.documents).toBe(true);
      expect(astraCaps.source).toBe("heuristic");

      const gpt5Caps = getModelAttachmentCapabilities("gpt-5-preview");
      expect(gpt5Caps.images).toBe(true);
      expect(gpt5Caps.documents).toBe(true);
      expect(gpt5Caps.source).toBe("heuristic");
    });

    it("heuristic: gpt-4o model gets documents=false (no Claude heuristic)", () => {
      const caps = getModelAttachmentCapabilities("gpt-4o");
      expect(caps.images).toBe(true);
      expect(caps.documents).toBe(false);
      expect(caps.source).toBe("heuristic");
    });

    it("unknown model returns all false", () => {
      const caps = getModelAttachmentCapabilities("my-local-model");
      expect(caps.images).toBe(false);
      expect(caps.audio).toBe(false);
      expect(caps.video).toBe(false);
      expect(caps.documents).toBe(false);
      expect(caps.source).toBe("unknown");
    });

    it("recognizes Qwen VL and Llama Vision models via heuristic", () => {
      const qwenCaps = getModelAttachmentCapabilities(
        "qwen/qwen-2.5-vl-72b-instruct",
      );
      expect(qwenCaps.images).toBe(true);

      const llamaCaps = getModelAttachmentCapabilities(
        "meta-llama/llama-3.2-11b-vision-instruct",
      );
      expect(llamaCaps.images).toBe(true);
    });

    it("explicitly non-vision / text-only models return all false despite pattern keywords", () => {
      const noVisionCaps = getModelAttachmentCapabilities(
        "text-only-model-no-vision",
      );
      expect(noVisionCaps.images).toBe(false);
      expect(noVisionCaps.source).toBe("unknown");

      const nonVisionCaps = getModelAttachmentCapabilities(
        "claude-3-5-non-vision",
      );
      expect(nonVisionCaps.images).toBe(false);
      expect(nonVisionCaps.documents).toBe(false);
      expect(nonVisionCaps.source).toBe("unknown");

      const textOnlyCaps = getModelAttachmentCapabilities("gpt-4o-text-only");
      expect(textOnlyCaps.images).toBe(false);
      expect(textOnlyCaps.source).toBe("unknown");
    });

    it("recognizes openrouter router models with routerByFeatures=true", () => {
      const freeCaps = getModelAttachmentCapabilities("openrouter/free");
      expect(freeCaps.routerByFeatures).toBe(true);

      const autoCaps = getModelAttachmentCapabilities("openrouter/auto");
      expect(autoCaps.routerByFeatures).toBe(true);
    });

    it("recognizes Omni multimodal models via heuristic", () => {
      const omniCaps = getModelAttachmentCapabilities(
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      );
      expect(omniCaps.images).toBe(true);
      expect(omniCaps.audio).toBe(true);
      expect(omniCaps.video).toBe(true);
    });
  });
});
