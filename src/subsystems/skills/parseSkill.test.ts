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
});
