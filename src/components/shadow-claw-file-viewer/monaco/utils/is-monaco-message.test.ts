import { describe, expect, it } from "@jest/globals";

import {
  isEditorToHostMessage,
  isHostToEditorMessage,
} from "./is-monaco-message.js";

describe("isEditorToHostMessage", () => {
  it("accepts valid editor messages", () => {
    expect(isEditorToHostMessage({ type: "ready" })).toBe(true);
    expect(isEditorToHostMessage({ type: "change", value: "x" })).toBe(true);
    expect(isEditorToHostMessage({ type: "save-request" })).toBe(true);
    expect(isEditorToHostMessage({ type: "escape" })).toBe(true);
    expect(isEditorToHostMessage({ type: "error", message: "m" })).toBe(true);
    expect(
      isEditorToHostMessage({ type: "value", requestId: "1", value: "" }),
    ).toBe(true);
  });

  it("rejects malformed messages", () => {
    expect(isEditorToHostMessage(null)).toBe(false);
    expect(isEditorToHostMessage("ready")).toBe(false);
    expect(isEditorToHostMessage({ type: "unknown" })).toBe(false);
    expect(isEditorToHostMessage({ type: "change" })).toBe(false);
    expect(isEditorToHostMessage({ type: "change", value: 1 })).toBe(false);
    expect(isEditorToHostMessage({ type: "value", value: "x" })).toBe(false);
    expect(isEditorToHostMessage({ type: "error" })).toBe(false);
  });
});

describe("isHostToEditorMessage", () => {
  it("accepts valid host messages", () => {
    expect(
      isHostToEditorMessage({
        type: "init",
        value: "",
        language: "json",
        readOnly: true,
        theme: "dark",
        customProperties: {},
        ariaLabel: "a",
      }),
    ).toBe(true);
    expect(isHostToEditorMessage({ type: "set-value", value: "x" })).toBe(true);
    expect(
      isHostToEditorMessage({ type: "set-read-only", readOnly: false }),
    ).toBe(true);
    expect(
      isHostToEditorMessage({ type: "set-language", language: "md" }),
    ).toBe(true);
    expect(
      isHostToEditorMessage({
        type: "theme",
        theme: "light",
        customProperties: {},
      }),
    ).toBe(true);
    expect(isHostToEditorMessage({ type: "focus" })).toBe(true);
    expect(isHostToEditorMessage({ type: "get-value", requestId: "1" })).toBe(
      true,
    );
  });

  it("rejects malformed messages", () => {
    expect(isHostToEditorMessage(undefined)).toBe(false);
    expect(isHostToEditorMessage({ type: "init" })).toBe(false);
    expect(
      isHostToEditorMessage({ type: "set-read-only", readOnly: "no" }),
    ).toBe(false);
    expect(isHostToEditorMessage({ type: "theme", theme: "blue" })).toBe(false);
    expect(isHostToEditorMessage({ type: "get-value" })).toBe(false);
    expect(isHostToEditorMessage({ type: "nope" })).toBe(false);
  });
});
