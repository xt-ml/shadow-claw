import type { A2UIAction, A2UIEnvelope } from "../../ui/a2ui.js";
import type { MessageAttachment } from "../../content/types.js";

export type ChannelDisplayCallback = (
  groupId: string,
  text: string,
  isFromMe: boolean,
) => void;

export type ChannelMessageCallback = (msg: InboundMessage) => void;

export type ChannelRegistrationOptions = {
  autoTrigger?: boolean;
  badge?: string;
};

export type ChannelType = KnownChannelType | (string & {});

export type ChannelTypingCallback = (groupId: string, typing: boolean) => void;

export type KnownChannelType =
  | "browser"
  | "imessage"
  | "peerjs"
  | "room"
  | "telegram";

export interface Channel {
  onMessage(callback: ChannelMessageCallback): void;
  onTyping?(callback: ChannelTypingCallback): void;
  send(
    groupId: string,
    text: string,
    attachments?: MessageAttachment[],
  ): Promise<void>;
  setTyping(groupId: string, typing: boolean): void;
  start(): void;
  stop(): void;
  type: ChannelType;
}

export interface InboundMessage {
  id: string;
  groupId: string;
  sender: string;
  content: string;
  timestamp: number;
  channel: ChannelType;
  attachments?: MessageAttachment[];
  a2uiEnvelopes?: A2UIEnvelope[];
  a2uiAction?: A2UIAction;
  contextId?: string;
  taskId?: string;
}

export interface RoomMember {
  agentName?: string;
  alias: string;
  kind: "agent" | "human";
  peerId: string;
}

export interface RoomMeta {
  createdAt: number;
  hostPeerId: string;
  members: RoomMember[];
  name: string;
  roomId: string;
}
