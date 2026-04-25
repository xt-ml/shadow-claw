/**
 * ShadowClaw — Channel Registry
 *
 * Generic registry that maps groupId prefixes to Channel implementations.
 * Channels register with a prefix (e.g. "br:", "ext:", "custom:") and the
 * registry routes groupIds to the correct channel at runtime.
 */

import {
  Channel,
  ChannelRegistrationOptions,
  ChannelType,
  InboundMessage,
} from "../types.js";

interface ChannelEntry {
  prefix: string;
  channel: Channel;
  badge: string;
  autoTrigger: boolean;
}

export class ChannelRegistry {
  _entries: ChannelEntry[];

  constructor() {
    this._entries = [];
  }

  /**
   * Register a channel for a given prefix.
   */
  register(
    prefix: string,
    channel: Channel,
    badgeOrOptions?: string | ChannelRegistrationOptions,
  ) {
    const options =
      typeof badgeOrOptions === "string"
        ? { badge: badgeOrOptions }
        : (badgeOrOptions ?? {});

    this._entries.push({
      prefix,
      channel,
      badge: options.badge ?? prefix.replace(/:$/, ""),
      autoTrigger: options.autoTrigger ?? false,
    });
    // Sort by prefix length descending so longest‑prefix wins in find()
    this._entries.sort((a, b) => b.prefix.length - a.prefix.length);
  }

  /**
   * Resolve the full channel entry for a groupId.
   */
  resolve(groupId: string): ChannelEntry | null {
    for (const entry of this._entries) {
      if (groupId.startsWith(entry.prefix)) {
        return entry;
      }
    }

    return null;
  }

  /**
   * Find the channel that owns a groupId.
   * Matches the longest registered prefix.
   */
  find(groupId: string): Channel | null {
    return this.resolve(groupId)?.channel ?? null;
  }

  /**
   * Get a channel by its exact prefix.
   */
  get(prefix: string): Channel | undefined {
    return this._entries.find((e) => e.prefix === prefix)?.channel;
  }

  /**
   * Get a badge label for a groupId based on its prefix.
   */
  getBadge(groupId: string): string {
    return this.resolve(groupId)?.badge ?? "";
  }

  /**
   * Resolve a channel type from the group prefix.
   */
  getChannelType(groupId: string): ChannelType | null {
    return this.resolve(groupId)?.channel.type ?? null;
  }

  /**
   * Whether this channel should auto-trigger the agent.
   */
  shouldAutoTrigger(groupId: string): boolean {
    return this.resolve(groupId)?.autoTrigger ?? false;
  }

  /**
   * List all registered prefixes.
   */
  prefixes(): string[] {
    return this._entries.map((e) => e.prefix);
  }

  /**
   * Start all registered channels.
   */
  startAll() {
    for (const entry of this._entries) {
      entry.channel.start();
    }
  }

  /**
   * Stop all registered channels.
   */
  stopAll() {
    for (const entry of this._entries) {
      entry.channel.stop();
    }
  }

  /**
   * Register a message handler on all channels.
   */
  onMessage(handler: (msg: InboundMessage) => void) {
    for (const entry of this._entries) {
      entry.channel.onMessage(handler);
    }
  }
}
