import { getModelMaxTokens } from "../../config/config.js";
import { getContextLimit, supportsPromptCaching } from "./providers.js";
import { getModelAttachmentCapabilities } from "../../content/attachment-capabilities.js";
import { supportsAdaptiveThinking } from "../../server/routes/bedrock-adaptive.js";
import {
  STATIC_MODEL_CATALOG,
  seedStaticModelCatalog,
} from "../../config/model-catalog.js";
import { modelRegistry } from "./model-registry.js";

describe("Model Consistency Across Subsystems", () => {
  beforeEach(() => {
    modelRegistry.models.clear();
  });

  it("exports a non-empty STATIC_MODEL_CATALOG with canonical frontier models", () => {
    expect(Array.isArray(STATIC_MODEL_CATALOG)).toBe(true);
    expect(STATIC_MODEL_CATALOG.length).toBeGreaterThan(0);

    const modelIds = STATIC_MODEL_CATALOG.map((m) => m.id);
    expect(modelIds).toContain("claude-fable-5");
    expect(modelIds).toContain("claude-sonnet-5");
    expect(modelIds).toContain("claude-opus-5");
    expect(modelIds).toContain("claude-mythos-5");
    expect(modelIds).toContain("gpt-6-astra");
    expect(modelIds).toContain("gpt-6-sol");
    expect(modelIds).toContain("gpt-6-luna");
    expect(modelIds).toContain("gemini-3.5-pro");
  });

  it("seeds modelRegistry successfully using seedStaticModelCatalog", () => {
    expect(modelRegistry.getModelInfo("claude-fable-5")).toBeNull();
    seedStaticModelCatalog();

    const fableInfo = modelRegistry.getModelInfo("claude-fable-5");
    expect(fableInfo).not.toBeNull();
    expect(fableInfo?.contextWindow).toBe(1000000);
    expect(fableInfo?.maxOutput).toBe(128000);
    expect(fableInfo?.supportsImageInput).toBe(true);
    expect(fableInfo?.supportsDocumentInput).toBe(true);
    expect(fableInfo?.supportsPromptCaching).toBe(true);

    const astraInfo = modelRegistry.getModelInfo("gpt-6-astra");
    expect(astraInfo).not.toBeNull();
    expect(astraInfo?.contextWindow).toBe(1050000);
    expect(astraInfo?.maxOutput).toBe(128000);
    expect(astraInfo?.supportsImageInput).toBe(true);
    expect(astraInfo?.supportsDocumentInput).toBe(true);
  });

  describe("Heuristic & catalog consistency across canonical models", () => {
    const testCases: Array<{
      id: string;
      expectedContext: number;
      expectedMaxTokens: number;
      expectedImages: boolean;
      expectedDocuments: boolean;
      expectedPromptCaching: boolean;
      expectedAdaptiveThinking: boolean;
    }> = [
      {
        id: "claude-fable-5",
        expectedContext: 1000000,
        expectedMaxTokens: 128000,
        expectedImages: true,
        expectedDocuments: true,
        expectedPromptCaching: true,
        expectedAdaptiveThinking: true,
      },
      {
        id: "claude-sonnet-5",
        expectedContext: 1000000,
        expectedMaxTokens: 128000,
        expectedImages: true,
        expectedDocuments: true,
        expectedPromptCaching: true,
        expectedAdaptiveThinking: true,
      },
      {
        id: "claude-opus-5",
        expectedContext: 1000000,
        expectedMaxTokens: 128000,
        expectedImages: true,
        expectedDocuments: true,
        expectedPromptCaching: true,
        expectedAdaptiveThinking: true,
      },
      {
        id: "claude-mythos-5",
        expectedContext: 1000000,
        expectedMaxTokens: 128000,
        expectedImages: true,
        expectedDocuments: true,
        expectedPromptCaching: true,
        expectedAdaptiveThinking: true,
      },
      {
        id: "gpt-6-astra",
        expectedContext: 1050000,
        expectedMaxTokens: 128000,
        expectedImages: true,
        expectedDocuments: true,
        expectedPromptCaching: false,
        expectedAdaptiveThinking: false,
      },
      {
        id: "gpt-6-sol",
        expectedContext: 1050000,
        expectedMaxTokens: 128000,
        expectedImages: true,
        expectedDocuments: true,
        expectedPromptCaching: false,
        expectedAdaptiveThinking: false,
      },
      {
        id: "gpt-6-luna",
        expectedContext: 1000000,
        expectedMaxTokens: 64000,
        expectedImages: true,
        expectedDocuments: true,
        expectedPromptCaching: false,
        expectedAdaptiveThinking: false,
      },
      {
        id: "gemini-3.5-pro",
        expectedContext: 2097152,
        expectedMaxTokens: 65536,
        expectedImages: true,
        expectedDocuments: true,
        expectedPromptCaching: false,
        expectedAdaptiveThinking: false,
      },
      {
        id: "gemini-3.5-flash",
        expectedContext: 1048576,
        expectedMaxTokens: 65536,
        expectedImages: true,
        expectedDocuments: true,
        expectedPromptCaching: false,
        expectedAdaptiveThinking: false,
      },
    ];

    for (const tc of testCases) {
      describe(`Model: ${tc.id}`, () => {
        it("matches expected max tokens limit", () => {
          expect(getModelMaxTokens(tc.id)).toBe(tc.expectedMaxTokens);
        });

        it("matches expected context window limit", () => {
          expect(getContextLimit(tc.id)).toBe(tc.expectedContext);
        });

        it("matches expected attachment capabilities", () => {
          const caps = getModelAttachmentCapabilities(tc.id);
          expect(caps.images).toBe(tc.expectedImages);
          expect(caps.documents).toBe(tc.expectedDocuments);
        });

        it("matches expected prompt caching capability", () => {
          expect(supportsPromptCaching(tc.id)).toBe(tc.expectedPromptCaching);
        });

        it("matches expected Bedrock adaptive thinking capability", () => {
          expect(supportsAdaptiveThinking(tc.id, tc.id)).toBe(
            tc.expectedAdaptiveThinking,
          );
        });
      });
    }
  });

  it("verifies static catalog definitions match heuristic outputs without registry", () => {
    // With registry cleared, heuristics should still match catalog specs
    for (const model of STATIC_MODEL_CATALOG) {
      expect(getModelMaxTokens(model.id)).toBe(model.maxOutput);
      expect(getContextLimit(model.id)).toBe(model.contextWindow);

      const caps = getModelAttachmentCapabilities(model.id);
      expect(caps.images).toBe(model.supportsImages);
      expect(caps.documents).toBe(model.supportsDocuments);

      if (model.supportsPromptCaching !== undefined) {
        expect(supportsPromptCaching(model.id)).toBe(
          model.supportsPromptCaching,
        );
      }
      if (model.supportsThinking !== undefined) {
        expect(supportsAdaptiveThinking(model.id, model.id)).toBe(
          model.supportsThinking,
        );
      }
    }
  });
});
