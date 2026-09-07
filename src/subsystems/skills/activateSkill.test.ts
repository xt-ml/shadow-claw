import { jest } from "@jest/globals";

const mockLoadSkill = jest.fn() as any;
const mockDiscoverSkills = jest.fn() as any;

jest.unstable_mockModule("./discoverSkills.js", () => ({
  loadSkill: mockLoadSkill,
  discoverSkills: mockDiscoverSkills,
}));

const { executeActivateSkill } = await import("./activateSkill.js");

describe("executeActivateSkill", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDiscoverSkills.mockResolvedValue({
      skills: [{ name: "existing-skill", description: "An existing skill" }],
      diagnostics: [],
    });
  });

  it("returns error when skill name is missing or empty, including available skills", async () => {
    const res1 = await executeActivateSkill({} as any, {}, "group-1");
    expect(res1).toContain("Error: activate_skill requires a skill name.");
    expect(res1).toContain("Available skills: existing-skill.");

    const res2 = await executeActivateSkill(
      {} as any,
      { name: "   " },
      "group-1",
    );
    expect(res2).toContain("Error: activate_skill requires a skill name.");
    expect(res2).toContain("Available skills: existing-skill.");
  });

  it("returns error when skill is not found, including available skills", async () => {
    mockLoadSkill.mockResolvedValue(null);

    const res = await executeActivateSkill(
      {} as any,
      { name: "my-skill" },
      "group-1",
    );
    expect(res).toContain(
      'Error: skill "my-skill" was not found in this conversation workspace.',
    );
    expect(res).toContain("Available skills: existing-skill.");
  });

  it("reports matched diagnostic when a skill exists on disk but failed to parse", async () => {
    mockLoadSkill.mockResolvedValue(null);
    mockDiscoverSkills.mockResolvedValue({
      skills: [{ name: "existing-skill", description: "An existing skill" }],
      diagnostics: [
        {
          path: ".agents/skills/main/broken-skill/SKILL.md",
          message: "YAML parse error on line 3",
        },
      ],
    });

    const res = await executeActivateSkill(
      {} as any,
      { name: "broken-skill" },
      "group-1",
    );
    expect(res).toContain(
      'Error: skill "broken-skill" was found at ".agents/skills/main/broken-skill/SKILL.md" but failed to load: YAML parse error on line 3.',
    );
    expect(res).toContain("Please fix the frontmatter in SKILL.md.");
    expect(res).toContain("Available skills: existing-skill.");
  });

  it("returns error when skill disables model invocation", async () => {
    mockLoadSkill.mockResolvedValue({
      name: "secret-skill",
      disableModelInvocation: true,
    });

    const res = await executeActivateSkill(
      {} as any,
      { name: "secret-skill" },
      "group-1",
    );
    expect(res).toBe(
      'Error: skill "secret-skill" is not available for model-driven activation.',
    );
  });

  it("formats skill content without resources", async () => {
    mockLoadSkill.mockResolvedValue({
      name: "summarize",
      body: "Instructions for summarizing texts.",
      basePath: ".agents/skills/summarize",
      resources: [],
    });

    const res = await executeActivateSkill(
      {} as any,
      { name: "summarize" },
      "group-1",
    );
    expect(res).toContain('<skill_content name="summarize">');
    expect(res).toContain("Instructions for summarizing texts.");
    expect(res).toContain("Skill directory: .agents/skills/summarize");
    expect(res).not.toContain("<skill_resources>");
    expect(res).toContain("</skill_content>");
  });

  it("formats skill content with fallback body and resources", async () => {
    mockLoadSkill.mockResolvedValue({
      name: "data-analysis",
      body: "",
      basePath: ".agents/skills/data-analysis",
      resources: [
        ".agents/skills/data-analysis/template.py",
        ".agents/skills/data-analysis/data.csv",
      ],
    });

    const res = await executeActivateSkill(
      {} as any,
      { name: "data-analysis" },
      "group-1",
    );
    expect(res).toContain("(This skill has no instructions.)");
    expect(res).toContain("<skill_resources>");
    expect(res).toContain(
      "<file>.agents/skills/data-analysis/template.py</file>",
    );
    expect(res).toContain("<file>.agents/skills/data-analysis/data.csv</file>");
    expect(res).toContain("</skill_resources>");
  });
});
