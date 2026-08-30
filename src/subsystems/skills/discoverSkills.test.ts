import { jest } from "@jest/globals";

const mockGetGroupDir = jest.fn() as any;
const mockReadGroupFile = jest.fn() as any;

jest.unstable_mockModule("../../storage/getGroupDir.js", () => ({
  getGroupDir: mockGetGroupDir,
}));

jest.unstable_mockModule("../../storage/readGroupFile.js", () => ({
  readGroupFile: mockReadGroupFile,
}));

const { discoverSkills, loadSkill } = await import("./discoverSkills.js");
const { DEFAULT_GROUP_ID } = await import("../../config/config.js");

function createMockDirectoryHandle(
  name: string,
  children: Record<string, any> = {},
) {
  return {
    kind: "directory",
    name,
    getDirectoryHandle: jest.fn(async (childName: string) => {
      const child = children[childName];
      if (!child || child.kind !== "directory") {
        throw new Error(`Directory not found: ${childName}`);
      }
      return child;
    }),
    entries: async function* () {
      for (const [childName, child] of Object.entries(children)) {
        yield [childName, child];
      }
    },
  };
}

function createMockFileHandle(name: string) {
  return {
    kind: "file",
    name,
  };
}

describe("discoverSkills and loadSkill", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty results when .agents or .agents/skills does not exist", async () => {
    const root = createMockDirectoryHandle("root", {});
    mockGetGroupDir.mockResolvedValue(root);

    const result = await discoverSkills({} as any, DEFAULT_GROUP_ID);
    expect(result.skills).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it("discovers skills from .agents/skills directory hierarchy", async () => {
    const skillA = createMockDirectoryHandle("skill-a", {
      "SKILL.md": createMockFileHandle("SKILL.md"),
    });
    const skillsDir = createMockDirectoryHandle("skills", {
      "skill-a": skillA,
    });
    const agentsDir = createMockDirectoryHandle(".agents", {
      skills: skillsDir,
    });
    const root = createMockDirectoryHandle("root", {
      ".agents": agentsDir,
    });

    mockGetGroupDir.mockResolvedValue(root);
    mockReadGroupFile.mockResolvedValue(`---
name: skill-a
description: First test skill
---
# Skill A Content
`);

    const result = await discoverSkills({} as any, DEFAULT_GROUP_ID);
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].name).toBe("skill-a");
    expect(result.skills[0].description).toBe("First test skill");
    expect(result.skills[0].path).toBe(".agents/skills/skill-a/SKILL.md");
    expect(result.diagnostics).toEqual([]);
  });

  it("records diagnostic when duplicate skill names exist in current group", async () => {
    const skillA1 = createMockDirectoryHandle("skill-a1", {
      "SKILL.md": createMockFileHandle("SKILL.md"),
    });
    const skillA2 = createMockDirectoryHandle("skill-a2", {
      "SKILL.md": createMockFileHandle("SKILL.md"),
    });
    const skillsDir = createMockDirectoryHandle("skills", {
      "skill-a1": skillA1,
      "skill-a2": skillA2,
    });
    const agentsDir = createMockDirectoryHandle(".agents", {
      skills: skillsDir,
    });
    const root = createMockDirectoryHandle("root", {
      ".agents": agentsDir,
    });

    mockGetGroupDir.mockResolvedValue(root);
    // Both return the same name "duplicate-skill"
    mockReadGroupFile.mockResolvedValue(`---
name: duplicate-skill
description: Dup skill
---
Body
`);

    const result = await discoverSkills({} as any, DEFAULT_GROUP_ID);
    expect(result.skills).toHaveLength(1);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain(
      "Duplicate skill name: duplicate-skill",
    );
  });

  it("records diagnostic when skill parsing fails (invalid frontmatter)", async () => {
    const brokenSkill = createMockDirectoryHandle("broken", {
      "SKILL.md": createMockFileHandle("SKILL.md"),
    });
    const skillsDir = createMockDirectoryHandle("skills", {
      broken: brokenSkill,
    });
    const agentsDir = createMockDirectoryHandle(".agents", {
      skills: skillsDir,
    });
    const root = createMockDirectoryHandle("root", {
      ".agents": agentsDir,
    });

    mockGetGroupDir.mockResolvedValue(root);
    mockReadGroupFile.mockResolvedValue(`invalid content without frontmatter`);

    const result = await discoverSkills({} as any, DEFAULT_GROUP_ID);
    expect(result.skills).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toBeTruthy();
  });

  it("stops and adds diagnostic when visited directories exceeds limit", async () => {
    const deepChildren: Record<string, any> = {};
    for (let i = 0; i <= 2001; i++) {
      deepChildren[`dir_${i}`] = createMockDirectoryHandle(`dir_${i}`, {});
    }

    const skillsDir = createMockDirectoryHandle("skills", deepChildren);
    const agentsDir = createMockDirectoryHandle(".agents", {
      skills: skillsDir,
    });
    const root = createMockDirectoryHandle("root", {
      ".agents": agentsDir,
    });

    mockGetGroupDir.mockResolvedValue(root);

    const result = await discoverSkills({} as any, DEFAULT_GROUP_ID);
    expect(
      result.diagnostics.some((d) =>
        d.message.includes("stopped after 2000 directories"),
      ),
    ).toBe(true);
  });

  it("scans custom group first then fallback main group", async () => {
    const rootCustom = createMockDirectoryHandle("rootCustom", {});
    const skillDefault = createMockDirectoryHandle("default-skill", {
      "SKILL.md": createMockFileHandle("SKILL.md"),
    });
    const skillsDir = createMockDirectoryHandle("skills", {
      "default-skill": skillDefault,
    });
    const agentsDir = createMockDirectoryHandle(".agents", {
      skills: skillsDir,
    });
    const rootDefault = createMockDirectoryHandle("rootDefault", {
      ".agents": agentsDir,
    });

    mockGetGroupDir.mockImplementation(async (_db: any, gId: string) => {
      if (gId === "custom-group") return rootCustom;
      return rootDefault;
    });

    mockReadGroupFile.mockResolvedValue(`---
name: default-skill
description: Default fallback
---
Body
`);

    const result = await discoverSkills({} as any, "custom-group");
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].name).toBe("default-skill");
  });

  describe("loadSkill", () => {
    it("returns null if skill is not found", async () => {
      const root = createMockDirectoryHandle("root", {});
      mockGetGroupDir.mockResolvedValue(root);

      const skill = await loadSkill({} as any, DEFAULT_GROUP_ID, "nonexistent");
      expect(skill).toBeNull();
    });

    it("loads and refreshes skill with resources", async () => {
      const helperFile = createMockFileHandle("helper.py");
      const subFolder = createMockDirectoryHandle("scripts", {
        "run.sh": createMockFileHandle("run.sh"),
      });
      const skillDir = createMockDirectoryHandle("my-skill", {
        "SKILL.md": createMockFileHandle("SKILL.md"),
        "helper.py": helperFile,
        scripts: subFolder,
      });
      const skillsDir = createMockDirectoryHandle("skills", {
        "my-skill": skillDir,
      });
      const agentsDir = createMockDirectoryHandle(".agents", {
        skills: skillsDir,
      });
      const root = createMockDirectoryHandle("root", {
        ".agents": agentsDir,
      });

      mockGetGroupDir.mockResolvedValue(root);
      mockReadGroupFile.mockResolvedValue(`---
name: my-skill
description: Full loaded skill
---
Loaded body instructions
`);

      const loaded = await loadSkill({} as any, DEFAULT_GROUP_ID, "my-skill");
      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe("my-skill");
      expect(loaded?.body).toBe("Loaded body instructions");
      expect(loaded?.resources).toEqual([
        ".agents/skills/my-skill/helper.py",
        ".agents/skills/my-skill/scripts/run.sh",
      ]);
    });
  });
});
