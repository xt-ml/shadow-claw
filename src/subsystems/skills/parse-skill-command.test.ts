import { describe, expect, it } from "@jest/globals";

import { parseSkillCommand } from "./parse-skill-command.js";

const skill = (name: string, userInvocable?: boolean) => ({
  name,
  description: "A test skill",
  userInvocable,
});

describe("parseSkillCommand", () => {
  it("parses a known user-invocable skill and arguments", () => {
    expect(
      parseSkillCommand(" /toast-random-number now ", [
        skill("toast-random-number", true),
      ] as any),
    ).toEqual({
      skill: skill("toast-random-number", true),
      arguments: "now",
    });
  });

  it("treats skills without an explicit false flag as user-invocable", () => {
    expect(parseSkillCommand("/demo", [skill("demo")] as any)).toEqual(
      expect.objectContaining({ arguments: "" }),
    );
  });

  it("does not route unknown or disabled skills", () => {
    expect(parseSkillCommand("/unknown", [skill("demo")] as any)).toBeNull();
    expect(
      parseSkillCommand("/demo", [skill("demo", false)] as any),
    ).toBeNull();
  });

  it("returns null for non-slash command text or empty input", () => {
    expect(parseSkillCommand("hello world", [skill("demo")] as any)).toBeNull();
    expect(parseSkillCommand("", [skill("demo")] as any)).toBeNull();
  });
});
