/**
 * Message protocol between the File Viewer (host page) and the Monaco iframe.
 *
 * This module is intentionally free of any `monaco-editor` import so that it
 * can be shared by the main bundle and the lazily-built Monaco host entry.
 */

export type MonacoThemeName = "dark" | "light";

export type MonacoCustomProperties = Record<string, string>;

/** Posted once to the iframe window; carries a transferred MessagePort. */
export const MONACO_CONNECT_MESSAGE = "shadow-claw-monaco-connect";

export interface MonacoInitMessage {
  type: "init";
  value: string;
  language: string;
  readOnly: boolean;
  theme: MonacoThemeName;
  customProperties: MonacoCustomProperties;
  ariaLabel: string;
  fontFamily?: string;
  forcedColors?: boolean;
}

export interface MonacoSetValueMessage {
  type: "set-value";
  value: string;
}

export interface MonacoSetReadOnlyMessage {
  type: "set-read-only";
  readOnly: boolean;
}

export interface MonacoSetLanguageMessage {
  type: "set-language";
  language: string;
}

export interface MonacoThemeMessage {
  type: "theme";
  theme: MonacoThemeName;
  customProperties: MonacoCustomProperties;
  forcedColors?: boolean;
}

export interface MonacoFocusMessage {
  type: "focus";
}

export interface MonacoGetValueMessage {
  type: "get-value";
  requestId: string;
}

export type HostToEditorMessage =
  | MonacoInitMessage
  | MonacoSetValueMessage
  | MonacoSetReadOnlyMessage
  | MonacoSetLanguageMessage
  | MonacoThemeMessage
  | MonacoFocusMessage
  | MonacoGetValueMessage;

export type EditorToHostMessage =
  | { type: "ready" }
  | { type: "change"; value: string }
  | { type: "save-request" }
  | { type: "escape" }
  | { type: "value"; requestId: string; value: string }
  | { type: "error"; message: string };

export type MonacoStatus = "loading" | "ready" | "fallback";
