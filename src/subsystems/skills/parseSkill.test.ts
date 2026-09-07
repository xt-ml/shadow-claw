import { describe, expect, it } from "@jest/globals";

import { parseSkill } from "./parseSkill.js";

describe("parseSkill", () => {
  it("parses compatible metadata and preserves the markdown body", () => {
    const result = parseSkill(
      "skills/demo/SKILL.md",
      `---\nname: demo\ndescription: Use this for demo work\nlicense: MIT\ncompatibility: ShadowClaw\nmetadata:\n  author: example\n  allowed-tools: read_file bash\n---\n\n# Demo\n\nRun scripts/example.sh.`,
    );

    expect(result).toEqual({
      name: "demo",
      description: "Use this for demo work",
      license: "MIT",
      compatibility: "ShadowClaw",
      metadata: { author: "example", "allowed-tools": "read_file bash" },
      allowedTools: "read_file bash",
      body: "# Demo\n\nRun scripts/example.sh.",
      path: "skills/demo/SKILL.md",
      basePath: "skills/demo",
    });
  });

  it("rejects skills without a description", () => {
    expect(() =>
      parseSkill("skills/demo/SKILL.md", "---\nname: demo\n---\nbody"),
    ).toThrow("description");
  });

  it("parses an optional declarative tool execution with suppressToast and suppressOutput", () => {
    const result = parseSkill(
      "skills/demo/SKILL.md",
      `---\nname: demo\ndescription: Run a demo chain\nmetadata:\n  execution:\n    type: tools\n    suppressToast: true\n    suppressOutput: true\n    tools:\n      - name: javascript\n        input:\n          code: "1 + 1"\n      - name: show_toast\n        input:\n          message:\n            $pipe: prev\n---\nbody`,
    );

    expect(result.execution).toEqual({
      type: "tools",
      suppressToast: true,
      suppressOutput: true,
      tools: [
        {
          name: "javascript",
          input: { code: "1 + 1" },
          suppressToast: true,
          suppressOutput: true,
        },
        {
          name: "show_toast",
          input: { message: { $pipe: "prev" } },
          suppressToast: true,
          suppressOutput: true,
        },
      ],
    });
  });

  it("parses execution nested inside metadata block and excludes execution object from string metadata", () => {
    const result = parseSkill(
      "skills/demo/SKILL.md",
      `---\nname: demo\ndescription: Run a demo chain\nmetadata:\n  author: Alice\n  execution:\n    type: tools\n    suppressToast: true\n    tools:\n      - name: javascript\n        input:\n          code: "1 + 1"\n---\nbody`,
    );

    expect(result.metadata).toEqual({ author: "Alice" });
    expect(result.execution).toEqual({
      type: "tools",
      suppressToast: true,
      tools: [
        {
          name: "javascript",
          input: { code: "1 + 1" },
          suppressToast: true,
        },
      ],
    });
  });

  it("ignores top-level execution attribute outside metadata block", () => {
    const result = parseSkill(
      "skills/demo/SKILL.md",
      `---\nname: demo\ndescription: Run a demo chain\nexecution:\n  type: tools\n  tools:\n    - name: javascript\n      input:\n        code: "1 + 1"\n---\nbody`,
    );

    expect(result.execution).toBeUndefined();
  });

  it("resiliently parses frontmatter with unquoted colons, URLs, and quotes in description", () => {
    const rawSkill = `---
name: bible-lookup
description: Look up Bible verses from the bible-tools/data repository (https://bible-tools.github.io/data/). Supports multiple translations in Arabic (ar), German (de), English (en: ASV, KJV, WEB), Spanish (es), and French (fr). Trigger phrases: "bible lookup", "look up a bible verse", "bible verse", "find bible verse", "bible reference", "what does the bible say about", "scripture reference", "look up verse", "bible passage".
user-invocable: true
metadata:
  allowed-tools:
    - fetch_url
    - javascript
---

# Bible Lookup Skill

Instructions here.`;

    const result = parseSkill(
      ".agents/skills/main/bible-lookup/SKILL.md",
      rawSkill,
    );

    expect(result.name).toBe("bible-lookup");
    expect(result.description).toContain(
      "Look up Bible verses from the bible-tools/data repository",
    );
    expect(result.description).toContain("(en: ASV, KJV, WEB)");
    expect(result.userInvocable).toBe(true);
    expect(result.allowedTools).toBe("fetch_url javascript");
    expect(result.metadata?.["allowed-tools"]).toBe("fetch_url javascript");
    expect(result.body).toBe("# Bible Lookup Skill\n\nInstructions here.");
    expect(result.path).toBe(".agents/skills/main/bible-lookup/SKILL.md");
    expect(result.basePath).toBe(".agents/skills/main/bible-lookup");
  });

  it("normalizes array allowed-tools into a space-separated string", () => {
    const result = parseSkill(
      "skills/tools/SKILL.md",
      `---\nname: tools-test\ndescription: Test tools array\nmetadata:\n  allowed-tools:\n    - read_file\n    - write_file\n    - javascript\n---\nbody`,
    );

    expect(result.allowedTools).toBe("read_file write_file javascript");
    expect(result.metadata?.["allowed-tools"]).toBe(
      "read_file write_file javascript",
    );
  });

  it("recovers via fallback extraction when YAML syntax is malformed", () => {
    const brokenYaml = `---
name: broken-yaml-skill
description: Resilient fallback description with : colons and [broken brackets
user-invocable: true
disable-model-invocation: false
allowed-tools:
  - tool_a
  - tool_b
some_random_key: {unclosed object
---

# Fallback Body`;

    const result = parseSkill("skills/broken/SKILL.md", brokenYaml);

    expect(result.name).toBe("broken-yaml-skill");
    expect(result.description).toBe(
      "Resilient fallback description with : colons and [broken brackets",
    );
    expect(result.userInvocable).toBe(true);
    expect(result.disableModelInvocation).toBe(false);
    expect(result.allowedTools).toBe("tool_a tool_b");
    expect(result.body).toBe("# Fallback Body");
  });
});
