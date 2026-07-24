import { parseDirectToolCommand } from "./parseDirectToolCommand.js";

import type { InboundMessage } from "../../../subsystems/channels/types.js";
import type { DirectToolCommandPolicy } from "./types.js";

describe("parseDirectToolCommand", () => {
  const policy: DirectToolCommandPolicy = {
    enabledChannelTypes: ["cli", "api"],
    allowedTools: ["test_tool", "another_tool"],
    requireMention: false,
  };

  const assistantName = "TestAssistant";

  function createMsg(content: string, channel: string = "cli"): InboundMessage {
    return {
      channel,
      content,
      id: "msg-123",
      timestamp: Date.now(),
      author: "user",
    } as unknown as InboundMessage; // Type cast for minimal required fields
  }

  it("should return null if channel type is not enabled", () => {
    const msg = createMsg("/test_tool {}", "web");
    expect(parseDirectToolCommand(policy, assistantName, msg)).toBeNull();
  });

  it("should parse command without mention if requireMention is false", () => {
    const msg = createMsg('/test_tool {"foo":"bar"}');
    expect(parseDirectToolCommand(policy, assistantName, msg)).toEqual({
      toolName: "test_tool",
      input: { foo: "bar" },
    });
  });

  it("should return null if requireMention is true but no mention is provided", () => {
    const strictPolicy = { ...policy, requireMention: true };
    const msg = createMsg('/test_tool {"foo":"bar"}');
    expect(parseDirectToolCommand(strictPolicy, assistantName, msg)).toBeNull();
  });

  it("should parse command with mention if requireMention is true", () => {
    const strictPolicy = { ...policy, requireMention: true };
    const msg = createMsg('@TestAssistant /test_tool {"foo":"bar"}');
    expect(parseDirectToolCommand(strictPolicy, assistantName, msg)).toEqual({
      toolName: "test_tool",
      input: { foo: "bar" },
    });
  });

  it("should parse command with mention with dash or colon", () => {
    const strictPolicy = { ...policy, requireMention: true };

    expect(
      parseDirectToolCommand(
        strictPolicy,
        assistantName,
        createMsg('@TestAssistant: /test_tool {"foo":"bar"}'),
      ),
    ).toEqual({
      toolName: "test_tool",
      input: { foo: "bar" },
    });

    expect(
      parseDirectToolCommand(
        strictPolicy,
        assistantName,
        createMsg('@TestAssistant - /test_tool {"foo":"bar"}'),
      ),
    ).toEqual({
      toolName: "test_tool",
      input: { foo: "bar" },
    });
  });

  it("should return null if tool match fails (e.g. invalid format)", () => {
    const msg = createMsg("hello world");
    expect(parseDirectToolCommand(policy, assistantName, msg)).toBeNull();
  });

  it("should return null if tool name is not in allowedTools", () => {
    const msg = createMsg("/unallowed_tool {}");
    expect(parseDirectToolCommand(policy, assistantName, msg)).toBeNull();
  });

  it("should return empty input object if no args are provided", () => {
    const msg = createMsg("/test_tool");
    expect(parseDirectToolCommand(policy, assistantName, msg)).toEqual({
      toolName: "test_tool",
      input: {},
    });
  });

  it("should unwrap single or double quoted args and parse JSON", () => {
    const msg1 = createMsg("/test_tool '{\"a\":1}'");
    expect(parseDirectToolCommand(policy, assistantName, msg1)).toEqual({
      toolName: "test_tool",
      input: { a: 1 },
    });

    const msg2 = createMsg('/test_tool "{}"');
    expect(parseDirectToolCommand(policy, assistantName, msg2)).toEqual({
      toolName: "test_tool",
      input: {},
    });
  });

  it("should return null if JSON parsing fails", () => {
    const msg = createMsg("/test_tool {invalid-json}");
    expect(parseDirectToolCommand(policy, assistantName, msg)).toBeNull();
  });

  it("should return null if JSON parses to a primitive", () => {
    const msg = createMsg('/test_tool "hello"');
    expect(parseDirectToolCommand(policy, assistantName, msg)).toBeNull();
  });
});
