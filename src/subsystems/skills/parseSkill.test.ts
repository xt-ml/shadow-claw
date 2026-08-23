import { describe, expect, it } from "@jest/globals";

import { parseSkill } from "./parseSkill.js";

describe("parseSkill", () => {
  it("parses compatible metadata and preserves the markdown body", () => {
    const result = parseSkill(
      "skills/demo/SKILL.md",
      `---\nname: demo\ndescription: Use this for demo work\nlicense: MIT\ncompatibility: ShadowClaw\nmetadata:\n  author: example\nallowed-tools: read_file bash\n---\n\n# Demo\n\nRun scripts/example.sh.`,
    );

    expect(result).toEqual({
      name: "demo",
      description: "Use this for demo work",
      license: "MIT",
      compatibility: "ShadowClaw",
      metadata: { author: "example" },
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
});
