import {
  WriterPromptBuilder,
  RewriterPromptBuilder,
  SummarizerPromptBuilder,
} from "./builtin-ai-prompt-builders.js";

describe("Built-in AI Prompt Builders", () => {
  describe("WriterPromptBuilder", () => {
    it("builds default prompt with neutral tone, plain-text format, short length, and English output", () => {
      const builder = new WriterPromptBuilder();
      const { systemPrompt, userPrompt } = builder.buildPrompt(
        "Write a welcome note",
      );

      expect(userPrompt).toBe("TEXT: Write a welcome note");
      expect(systemPrompt).toContain(
        "You are a direct-instruction text generation AI",
      );
      expect(systemPrompt).toContain(
        "You MUST write exclusively and entirely in English.",
      );
      expect(systemPrompt).toContain("neutral");
      expect(systemPrompt).toContain("PLAIN TEXT");
      expect(systemPrompt).not.toContain("### CONTEXT GUIDANCE");
    });

    it("includes context guidance in system prompt and prefixes user prompt when context is provided", () => {
      const builder = new WriterPromptBuilder({
        sharedContext: "Company: Acme Corp",
        context: "Audience: New hires",
      });
      const { systemPrompt, userPrompt } =
        builder.buildPrompt("Draft an email");

      expect(userPrompt).toBe(
        "CONTEXT: Company: Acme Corp Audience: New hires TEXT: Draft an email",
      );
      expect(systemPrompt).toContain("### CONTEXT GUIDANCE");
      expect(systemPrompt).toContain(
        "Use the provided context to inform the tone and style",
      );
    });

    it("adapts system prompt for formal tone, markdown format, long length, and Spanish language", () => {
      const builder = new WriterPromptBuilder({
        tone: "formal",
        format: "markdown",
        length: "long",
        outputLanguage: "es",
      });
      const { systemPrompt, userPrompt } = builder.buildPrompt(
        "Annual financial summary",
      );

      expect(userPrompt).toBe("TEXT: Annual financial summary");
      expect(systemPrompt).toContain(
        "You MUST write exclusively and entirely in Spanish.",
      );
      expect(systemPrompt).toContain("formal");
      expect(systemPrompt).toMatch(/Markdown/i);
    });

    it("allows runtimeOptions to override constructor options", () => {
      const builder = new WriterPromptBuilder({
        tone: "neutral",
        length: "short",
      });
      const { systemPrompt } = builder.buildPrompt("Hello", {
        tone: "casual",
        length: "medium",
        outputLanguage: "fr",
      });

      expect(systemPrompt).toContain(
        "You MUST write exclusively and entirely in French.",
      );
      expect(systemPrompt).toContain("casual");
    });
  });

  describe("RewriterPromptBuilder", () => {
    it("builds default prompt with as-is tone, as-is format, as-is length, and English target language", () => {
      const builder = new RewriterPromptBuilder();
      const { systemPrompt, userPrompt } = builder.buildPrompt(
        "Please rewrite this messy draft.",
      );

      expect(userPrompt).toBe("TEXT: Please rewrite this messy draft.");
      expect(systemPrompt).toContain(
        "Distinguished Senior Editor and Linguistic Specialist",
      );
      expect(systemPrompt).toContain("**English**");
      expect(systemPrompt).toContain("SEMANTIC & FACTUAL FIDELITY");
      expect(systemPrompt).not.toContain("### CONTEXT GUIDANCE");
    });

    it("includes context guidance when context is supplied", () => {
      const builder = new RewriterPromptBuilder({
        context: "Make it suitable for a legal contract.",
      });
      const { systemPrompt, userPrompt } = builder.buildPrompt(
        "We agree to work together.",
      );

      expect(userPrompt).toBe(
        "CONTEXT: Make it suitable for a legal contract. TEXT: We agree to work together.",
      );
      expect(systemPrompt).toContain("### CONTEXT GUIDANCE");
    });

    it("adapts system prompt for more-formal tone, shorter length, and Japanese output language", () => {
      const builder = new RewriterPromptBuilder({
        tone: "more-formal",
        length: "shorter",
        outputLanguage: "ja",
      });
      const { systemPrompt } = builder.buildPrompt("Hey guys, what's up?");

      expect(systemPrompt).toContain("**Japanese**");
      expect(systemPrompt).toMatch(/more-formal|FORMAL/i);
      expect(systemPrompt).toMatch(/shorter|CONDENSED|SHORTER/i);
    });

    it("adapts system prompt for more-casual tone and longer length", () => {
      const builder = new RewriterPromptBuilder({
        tone: "more-casual",
        length: "longer",
        format: "markdown",
      });
      const { systemPrompt } = builder.buildPrompt("Status update text");

      expect(systemPrompt).toMatch(/more-casual|CASUAL/i);
      expect(systemPrompt).toMatch(/longer|EXPANDED|LONGER/i);
      expect(systemPrompt).toMatch(/Markdown/i);
    });
  });

  describe("SummarizerPromptBuilder", () => {
    it("builds default prompt with key-points type, markdown format, short length, and English output", () => {
      const builder = new SummarizerPromptBuilder();
      const { systemPrompt, userPrompt } = builder.buildPrompt(
        "Article body content here...",
      );

      expect(userPrompt).toBe("TEXT: Article body content here...");
      expect(systemPrompt).toContain(
        "skilled assistant that accurately summarizes content",
      );
      expect(systemPrompt).toContain("English");
      expect(systemPrompt).not.toContain(
        "Consider the guidance provided in the CONTEXT section",
      );
    });

    it("includes context instruction when context is present", () => {
      const builder = new SummarizerPromptBuilder({
        sharedContext: "Domain: Medical Research",
      });
      const { systemPrompt, userPrompt } = builder.buildPrompt(
        "Clinical trial results...",
      );

      expect(userPrompt).toBe(
        "CONTEXT: Domain: Medical Research TEXT: Clinical trial results...",
      );
      expect(systemPrompt).toContain(
        "Consider the guidance provided in the CONTEXT section",
      );
    });

    it("adapts system prompt for tldr type, plain-text format, and German language", () => {
      const builder = new SummarizerPromptBuilder({
        type: "tldr",
        format: "plain-text",
        length: "medium",
        outputLanguage: "de",
      });
      const { systemPrompt } = builder.buildPrompt("Long history chapter");

      expect(systemPrompt).toContain("German");
      expect(systemPrompt).toContain("short attention span");
      expect(systemPrompt).toContain("plain");
    });

    it("adapts system prompt for headline and teaser types", () => {
      const headlineBuilder = new SummarizerPromptBuilder({ type: "headline" });
      const { systemPrompt: headlinePrompt } = headlineBuilder.buildPrompt(
        "New product launched",
      );
      expect(headlinePrompt).toMatch(/headline/i);

      const teaserBuilder = new SummarizerPromptBuilder({ type: "teaser" });
      const { systemPrompt: teaserPrompt } = teaserBuilder.buildPrompt(
        "Upcoming event details",
      );
      expect(teaserPrompt).toMatch(/teaser/i);
    });

    it("supports overridePrompt to completely customize system prompt (as suggested by Thomas Steiner)", () => {
      const customPrompt =
        "You are a specialized code reviewer summarizing git pull requests into 3 bullet points.";
      const builder = new SummarizerPromptBuilder({
        overridePrompt: customPrompt,
      });
      const { systemPrompt, userPrompt } =
        builder.buildPrompt("git diff content");

      expect(systemPrompt).toBe(customPrompt);
      expect(userPrompt).toBe("TEXT: git diff content");
    });
  });
});
