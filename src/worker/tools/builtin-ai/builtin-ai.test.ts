import { jest } from "@jest/globals";

const mockPost = jest.fn();
jest.unstable_mockModule("../../utils/post.js", () => ({
  post: mockPost,
}));

let executeSummarizeText: any;
let executeWriteText: any;
let executeRewriteText: any;
let executeProofreadText: any;
let executeDetectLanguage: any;
let executeTranslateText: any;

describe("builtin-ai worker tools", () => {
  beforeAll(async () => {
    const mod = await import("./builtin-ai.js");
    executeSummarizeText = mod.executeSummarizeText;
    executeWriteText = mod.executeWriteText;
    executeRewriteText = mod.executeRewriteText;
    executeProofreadText = mod.executeProofreadText;
    executeDetectLanguage = mod.executeDetectLanguage;
    executeTranslateText = mod.executeTranslateText;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    (globalThis as any).pendingNativeAiResolvers = {};
  });

  // Helper to simulate the main thread immediately resolving the RPC
  const mockMainThreadResponse = (result: any) => {
    mockPost.mockImplementationOnce((msg: any) => {
      if (msg.type === "request-native-ai-task") {
        setTimeout(() => {
          const resolvers = (globalThis as any).pendingNativeAiResolvers;
          if (resolvers && resolvers[msg.payload.id]) {
            resolvers[msg.payload.id].resolve(result);
          }
        }, 0);
      }
    });
  };

  describe("executeSummarizeText", () => {
    it("returns error message when text is missing", async () => {
      const res = await executeSummarizeText({});
      expect(res).toBe("Error: text is required for summarize_text");
    });

    it("posts request to main thread and returns output", async () => {
      mockMainThreadResponse("Bullet point 1");

      const res = await executeSummarizeText({
        text: "Hello world",
        type: "key-points",
        preference: "speed",
      });
      expect(res).toBe("Bullet point 1");
      expect(mockPost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "request-native-ai-task",
          payload: expect.objectContaining({
            taskType: "summarize",
            input: expect.objectContaining({ preference: "speed" }),
          }),
        }),
      );
    });

    it("forwards outputLanguage, overridePrompt, and sharedContext to main thread", async () => {
      mockMainThreadResponse("Resumen");

      const res = await executeSummarizeText({
        text: "Long article",
        outputLanguage: "es",
        overridePrompt: "Custom summarizer prompt",
        sharedContext: "Tech domain",
      });
      expect(res).toBe("Resumen");
      expect(mockPost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "request-native-ai-task",
          payload: expect.objectContaining({
            taskType: "summarize",
            input: expect.objectContaining({
              outputLanguage: "es",
              overridePrompt: "Custom summarizer prompt",
              sharedContext: "Tech domain",
            }),
          }),
        }),
      );
    });
  });

  describe("executeWriteText", () => {
    it("returns error message when prompt is missing", async () => {
      const res = await executeWriteText({});
      expect(res).toBe("Error: prompt is required for write_text");
    });

    it("posts request to main thread and returns output", async () => {
      mockMainThreadResponse("Once upon a time");

      const res = await executeWriteText({ prompt: "Write a story" });
      expect(res).toBe("Once upon a time");
      expect(mockPost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "request-native-ai-task",
          payload: expect.objectContaining({ taskType: "write" }),
        }),
      );
    });

    it("forwards tone, format, length, outputLanguage, and sharedContext to main thread", async () => {
      mockMainThreadResponse("Formal report");

      const res = await executeWriteText({
        prompt: "Draft an announcement",
        tone: "formal",
        format: "markdown",
        length: "long",
        outputLanguage: "en",
        sharedContext: "Company memo",
      });
      expect(res).toBe("Formal report");
      expect(mockPost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "request-native-ai-task",
          payload: expect.objectContaining({
            taskType: "write",
            input: expect.objectContaining({
              tone: "formal",
              format: "markdown",
              length: "long",
              outputLanguage: "en",
              sharedContext: "Company memo",
            }),
          }),
        }),
      );
    });
  });

  describe("executeRewriteText", () => {
    it("returns error message when text is missing", async () => {
      const res = await executeRewriteText({});
      expect(res).toBe("Error: text is required for rewrite_text");
    });

    it("posts request to main thread and returns output", async () => {
      mockMainThreadResponse("Formal greeting");

      const res = await executeRewriteText({
        text: "Hey",
        tone: "more-formal",
      });
      expect(res).toBe("Formal greeting");
      expect(mockPost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "request-native-ai-task",
          payload: expect.objectContaining({ taskType: "rewrite" }),
        }),
      );
    });

    it("forwards format, outputLanguage, and sharedContext to main thread", async () => {
      mockMainThreadResponse("Polite email");

      const res = await executeRewriteText({
        text: "Need this done asap",
        tone: "more-formal",
        format: "markdown",
        length: "longer",
        outputLanguage: "en",
        sharedContext: "Workplace email",
      });
      expect(res).toBe("Polite email");
      expect(mockPost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "request-native-ai-task",
          payload: expect.objectContaining({
            taskType: "rewrite",
            input: expect.objectContaining({
              format: "markdown",
              outputLanguage: "en",
              sharedContext: "Workplace email",
            }),
          }),
        }),
      );
    });
  });

  describe("executeProofreadText", () => {
    it("returns error message when text is missing", async () => {
      const res = await executeProofreadText({});
      expect(res).toBe("Error: text is required for proofread_text");
    });

    it("posts request to main thread and returns output", async () => {
      mockMainThreadResponse("Corrected sentence.");

      const res = await executeProofreadText({
        text: "Im bad at grammar",
      });
      expect(res).toBe("Corrected sentence.");
      expect(mockPost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "request-native-ai-task",
          payload: expect.objectContaining({ taskType: "proofread" }),
        }),
      );
    });
  });

  describe("executeDetectLanguage", () => {
    it("returns error message when text is missing", async () => {
      const res = await executeDetectLanguage({});
      expect(res).toBe("Error: text is required for detect_language");
    });

    it("posts request to main thread and returns JSON output", async () => {
      mockMainThreadResponse([{ detectedLanguage: "fr", confidence: 0.95 }]);

      const res = await executeDetectLanguage({ text: "Bonjour" });
      expect(JSON.parse(res)).toEqual([
        { detectedLanguage: "fr", confidence: 0.95 },
      ]);
      expect(mockPost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "request-native-ai-task",
          payload: expect.objectContaining({ taskType: "detect-language" }),
        }),
      );
    });
  });

  describe("executeTranslateText", () => {
    it("returns error message when required parameters are missing", async () => {
      const res = await executeTranslateText({ text: "Hello" });
      expect(res).toBe(
        "Error: text, sourceLanguage, and targetLanguage are required for translate_text",
      );
    });

    it("posts request to main thread and returns output", async () => {
      mockMainThreadResponse("Bonjour");

      const res = await executeTranslateText({
        text: "Hello",
        sourceLanguage: "en",
        targetLanguage: "fr",
      });
      expect(res).toBe("Bonjour");
      expect(mockPost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "request-native-ai-task",
          payload: expect.objectContaining({ taskType: "translate" }),
        }),
      );
    });
  });
});
