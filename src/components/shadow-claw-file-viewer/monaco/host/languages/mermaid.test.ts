import { describe, expect, it } from "@jest/globals";

import {
  MERMAID_LANGUAGE_ID,
  mermaidLanguage,
  mermaidLanguageConfiguration,
} from "./mermaid.js";

describe("mermaid language definition", () => {
  it("has the expected id", () => {
    expect(MERMAID_LANGUAGE_ID).toBe("mermaid");
  });

  it("highlights diagram type keywords", () => {
    const keywords = (mermaidLanguage as any).diagramTypes as string[];

    for (const k of [
      "flowchart",
      "graph",
      "sequenceDiagram",
      "classDiagram",
      "stateDiagram-v2",
      "erDiagram",
      "gantt",
      "pie",
      "journey",
      "gitGraph",
      "mindmap",
      "timeline",
    ]) {
      expect(keywords).toContain(k);
    }
  });

  it("defines a root tokenizer whose regexes compile", () => {
    const root = (mermaidLanguage.tokenizer as any).root as unknown[];

    expect(Array.isArray(root)).toBe(true);
    expect(root.length).toBeGreaterThan(3);

    for (const rule of root) {
      const source = Array.isArray(rule) ? rule[0] : (rule as any).regex;
      if (source instanceof RegExp) {
        expect(() => new RegExp(source.source)).not.toThrow();
      }
    }
  });

  it("recognises %% comments and arrows", () => {
    const root = (mermaidLanguage.tokenizer as any).root as any[];
    const tokens = root.map((r) => (Array.isArray(r) ? r[1] : r.action));

    expect(tokens).toContain("comment");
    expect(JSON.stringify(tokens)).toContain("operator");
    expect(mermaidLanguageConfiguration.comments?.lineComment).toBe("%%");
  });

  it("configures bracket pairs and auto-closing pairs", () => {
    expect(mermaidLanguageConfiguration.brackets).toEqual(
      expect.arrayContaining([
        ["{", "}"],
        ["[", "]"],
        ["(", ")"],
      ]),
    );
    expect(
      mermaidLanguageConfiguration.autoClosingPairs?.length,
    ).toBeGreaterThan(2);
  });
});
