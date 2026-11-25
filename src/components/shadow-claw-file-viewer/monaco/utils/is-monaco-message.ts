import type { EditorToHostMessage, HostToEditorMessage } from "../types.js";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const isTheme = (v: unknown) => v === "dark" || v === "light";

export function isEditorToHostMessage(
  data: unknown,
): data is EditorToHostMessage {
  if (!isObject(data)) {
    return false;
  }

  switch (data.type) {
    case "ready":
    case "save-request":
    case "escape":
      return true;
    case "change":
      return typeof data.value === "string";
    case "value":
      return (
        typeof data.requestId === "string" && typeof data.value === "string"
      );
    case "error":
      return typeof data.message === "string";
    default:
      return false;
  }
}

export function isHostToEditorMessage(
  data: unknown,
): data is HostToEditorMessage {
  if (!isObject(data)) {
    return false;
  }

  switch (data.type) {
    case "init":
      return (
        typeof data.value === "string" &&
        typeof data.language === "string" &&
        typeof data.readOnly === "boolean" &&
        isTheme(data.theme) &&
        isObject(data.customProperties) &&
        typeof data.ariaLabel === "string"
      );
    case "set-value":
      return typeof data.value === "string";
    case "set-read-only":
      return typeof data.readOnly === "boolean";
    case "set-language":
      return typeof data.language === "string";
    case "theme":
      return isTheme(data.theme) && isObject(data.customProperties);
    case "focus":
      return true;
    case "get-value":
      return typeof data.requestId === "string";
    default:
      return false;
  }
}
