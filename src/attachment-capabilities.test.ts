import {
  getAttachmentCategory,
  getModelAttachmentCapabilities,
} from "./attachment-capabilities.js";
import { modelRegistry } from "./model-registry.js";

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
  });
});
