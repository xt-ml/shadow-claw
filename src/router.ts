import type { ChannelRegistry } from "./channels/channel-registry.js";
import type { Channel } from "./types.js";

export class Router {
  registry: ChannelRegistry;

  /**
   * Routes outbound messages and typing indicators to the correct channel
   * based on the groupId prefix, using a ChannelRegistry.
   */
  constructor(registry: ChannelRegistry) {
    this.registry = registry;
  }

  /**
   * Send a message to the correct channel
   */
  async send(groupId: string, text: string): Promise<void> {
    const channel = this.findChannel(groupId);
    if (!channel) {
      console.warn(`No channel for groupId: ${groupId}`);

      return;
    }

    await channel.send(groupId, text);
  }

  /**
   * Set typing indicator on the correct channel
   */
  setTyping(groupId: string, typing: boolean): void {
    const channel = this.findChannel(groupId);
    channel?.setTyping(groupId, typing);
  }

  /**
   * Strip internal tags from agent output
   */
  static formatOutbound(rawText: string): string {
    return rawText.replace(/<internal>[\s\S]*?<\/internal>/g, "").trim();
  }

  /**
   * Format messages in XML for agent context
   */
  static formatMessagesXml(messages: any[]): string {
    const escapeXml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const lines = messages.map(
      (m) =>
        `<message sender="${escapeXml(m.sender)}" time="${new Date(m.timestamp).toISOString()}">${escapeXml(m.content)}</message>`,
    );

    return `<messages>\n${lines.join("\n")}\n</messages>`;
  }

  /**
   * Find the appropriate channel for a groupId
   */
  findChannel(groupId: string): Channel | null {
    return this.registry.find(groupId);
  }
}
