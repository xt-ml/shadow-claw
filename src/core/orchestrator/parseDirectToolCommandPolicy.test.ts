import { parseDirectToolCommandPolicy } from "./parseDirectToolCommandPolicy.js";
import { DEFAULT_DIRECT_TOOL_COMMAND_POLICY } from "./types.js";

describe("parseDirectToolCommandPolicy", () => {
  it("returns the default policy for null", () => {
    expect(parseDirectToolCommandPolicy(null)).toEqual(
      DEFAULT_DIRECT_TOOL_COMMAND_POLICY,
    );
  });

  it("returns the default policy for undefined", () => {
    expect(parseDirectToolCommandPolicy(undefined)).toEqual(
      DEFAULT_DIRECT_TOOL_COMMAND_POLICY,
    );
  });

  it("returns the default policy for an empty string", () => {
    expect(parseDirectToolCommandPolicy("")).toEqual(
      DEFAULT_DIRECT_TOOL_COMMAND_POLICY,
    );
  });

  it("returns the default policy for invalid JSON", () => {
    expect(parseDirectToolCommandPolicy("{not valid json}")).toEqual(
      DEFAULT_DIRECT_TOOL_COMMAND_POLICY,
    );
  });

  it("parses a fully specified policy JSON string", () => {
    const raw = JSON.stringify({
      allowedTools: ["clear_chat"],
      enabledChannelTypes: ["telegram", "imessage"],
      requireMention: false,
    });

    expect(parseDirectToolCommandPolicy(raw)).toEqual({
      allowedTools: ["clear_chat"],
      enabledChannelTypes: ["telegram", "imessage"],
      requireMention: false,
    });
  });

  it("falls back to default enabledChannelTypes when field is absent", () => {
    const raw = JSON.stringify({ allowedTools: ["clear_chat"] });
    const result = parseDirectToolCommandPolicy(raw);

    expect(result.enabledChannelTypes).toEqual(
      DEFAULT_DIRECT_TOOL_COMMAND_POLICY.enabledChannelTypes,
    );
  });

  it("falls back to default allowedTools when field is absent", () => {
    const raw = JSON.stringify({ enabledChannelTypes: ["telegram"] });
    const result = parseDirectToolCommandPolicy(raw);

    expect(result.allowedTools).toEqual(
      DEFAULT_DIRECT_TOOL_COMMAND_POLICY.allowedTools,
    );
  });

  it("filters non-string values from enabledChannelTypes", () => {
    const raw = JSON.stringify({
      enabledChannelTypes: ["telegram", 42, null, "imessage"],
    });
    const result = parseDirectToolCommandPolicy(raw);

    expect(result.enabledChannelTypes).toEqual(["telegram", "imessage"]);
  });

  it("filters whitespace-only strings from allowedTools", () => {
    const raw = JSON.stringify({ allowedTools: ["clear_chat", "", "  "] });
    const result = parseDirectToolCommandPolicy(raw);

    expect(result.allowedTools).toEqual(["clear_chat"]);
  });

  it("falls back requireMention to default when the value is not a boolean", () => {
    const raw = JSON.stringify({ requireMention: "yes" });
    const result = parseDirectToolCommandPolicy(raw);

    expect(result.requireMention).toBe(
      DEFAULT_DIRECT_TOOL_COMMAND_POLICY.requireMention,
    );
  });

  it("returns a new object, not a reference to the default", () => {
    const result = parseDirectToolCommandPolicy(null);

    result.allowedTools.push("injected");

    expect(DEFAULT_DIRECT_TOOL_COMMAND_POLICY.allowedTools).not.toContain(
      "injected",
    );
  });
});
