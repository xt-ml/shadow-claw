/**
 * TDD tests for discoverServerSkills — host-filesystem skill discovery
 * for the A2A server agent card.
 *
 * These tests exercise the same parseSkill + NodeFsDirectoryHandle path
 * that the CLI agent uses, confirming it works correctly when called
 * from the server context with a real filesystem rootPath.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AgentSkill } from "../../subsystems/channels/peer-protocol.js";

let discoverServerSkills: (rootPath: string) => Promise<AgentSkill[]>;

beforeAll(async () => {
  ({ discoverServerSkills } = await import("./discover-server-skills.js"));
});

describe("discoverServerSkills", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-a2a-skills-test-"));
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns an empty array when no .agents/skills directory exists", async () => {
    const result = await discoverServerSkills(tempDir);
    expect(result).toEqual([]);
  });

  it("returns an empty array for an empty .agents/skills directory", async () => {
    fs.mkdirSync(path.join(tempDir, ".agents", "skills"), { recursive: true });
    const result = await discoverServerSkills(tempDir);
    expect(result).toEqual([]);
  });

  it("discovers and maps a valid skill to an AgentSkill", async () => {
    const skillDir = path.join(tempDir, ".agents", "skills", "weather-query");
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      `---\nname: weather-query\ndescription: Fetches weather information for a given location\n---\nFetch weather from the Open-Meteo API.\n`,
    );

    const result = await discoverServerSkills(tempDir);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("weather-query");
    expect(result[0].name).toBe("weather-query");
    expect(result[0].description).toBe(
      "Fetches weather information for a given location",
    );
    expect(result[0].tags).toEqual([]);
  });

  it("skips skills with invalid frontmatter silently", async () => {
    const badDir = path.join(tempDir, ".agents", "skills", "bad-skill");
    fs.mkdirSync(badDir, { recursive: true });
    fs.writeFileSync(
      path.join(badDir, "SKILL.md"),
      `---\nname: bad-skill\n---\nNo description here.\n`,
    );

    const result = await discoverServerSkills(tempDir);
    const ids = result.map((s) => s.id);
    expect(ids).not.toContain("bad-skill");
  });

  it("maps tags from skill frontmatter when present", async () => {
    const taggedDir = path.join(tempDir, ".agents", "skills", "tagged-skill");
    fs.mkdirSync(taggedDir, { recursive: true });
    fs.writeFileSync(
      path.join(taggedDir, "SKILL.md"),
      `---\nname: tagged-skill\ndescription: A skill with tags\ntags:\n  - weather\n  - forecast\n---\nBody content.\n`,
    );

    const result = await discoverServerSkills(tempDir);
    const tagged = result.find((s) => s.id === "tagged-skill");
    expect(tagged).toBeDefined();
    expect(tagged!.tags).toEqual(["weather", "forecast"]);
  });
});
