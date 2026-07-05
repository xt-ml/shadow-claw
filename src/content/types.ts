export interface AttachmentContent {
  data?: string;
  fileName: string;
  mediaType: "audio" | "document" | "file" | "image" | "video";
  mimeType: string;
  path?: string;
  size?: number;
  type: "attachment";
}

export interface ConversationMessage {
  content: string | ContentBlock[];
  role: "assistant" | "system" | "user";
}

export interface InlineTextAttachmentSource {
  kind: "inline-text";
  mimeType?: string;
  text: string;
}

export interface LocalFileAttachmentSource {
  file: Blob;
  kind: "local-file";
}

export interface MessageAttachment {
  fileName: string;
  id?: string;
  mimeType?: string;
  path?: string;
  previewDisposition?: "inline" | "file";
  size?: number;
  source?: MessageAttachmentSource;
}

export type MessageAttachmentSource =
  | InlineTextAttachmentSource
  | LocalFileAttachmentSource
  | RemoteUrlAttachmentSource;

export interface RemoteUrlAttachmentSource {
  headers?: Record<string, string>;
  kind: "remote-url";
  url: string;
}

export interface TextContent {
  text: string;
  type: "text";
}

export interface ToolResultContent {
  content: string | ToolResultContentBlock[];
  tool_use_id: string;
  type: "tool_result";
}

export type ToolResultContentBlock = ToolResultImageBlock | ToolResultTextBlock;

export interface ToolResultImageBlock {
  data: string;
  media_type: string;
  type: "image";
}

export interface ToolResultTextBlock {
  text: string;
  type: "text";
}

export interface ToolUseContent {
  id: string;
  input: Record<string, any>;
  name: string;
  type: "tool_use";
}

export type ContentBlock =
  | AttachmentContent
  | TextContent
  | ToolResultContent
  | ToolUseContent;
