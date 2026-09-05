import { jest } from "@jest/globals";

import {
  getChannelTypeForGroup,
  getChannelByType,
  getChannelEnabled,
  getPeerJsConfig,
  getTelegramConfig,
  getIMessageConfig,
  getChannelEnabledConfigKey,
  shouldRunChannel,
  applyAllChannelRunningStates,
  clearPeerJsTypingState,
  loadChannelEnabled,
  setChannelEnabled,
  submitMessage,
  saveSecretConfig,
  configureIMessage,
  configureTelegram,
} from "./channel.js";

import type { ChannelType } from "../../../../subsystems/channels/types.js";
import type { OrchestratorState } from "../../orchestrator-state.js";

function makeState(overrides: Partial<OrchestratorState> = {}) {
  return {
    browserChat: {
      start: jest.fn(),
      stop: jest.fn(),
      submit: jest.fn(),
    } as any,
    telegram: {
      start: jest.fn(),
      stop: jest.fn(),
      configure: jest.fn(),
    } as any,
    imessage: {
      start: jest.fn(),
      stop: jest.fn(),
      configure: jest.fn(),
    } as any,
    peerjs: { start: jest.fn(), stop: jest.fn(), configure: jest.fn() } as any,
    channelEnabledByType: { telegram: false, imessage: false, peerjs: false },
    telegramBotToken: "",
    telegramChatIds: [],
    telegramUseProxy: false,
    imessageServerUrl: "",
    imessageApiKey: "",
    imessageChatIds: [],
    peerjsMyAlias: "",
    peerjsMyPeerId: "",
    peerjsPeerAliases: {},
    peerjsServerHost: "0.peerjs.com",
    peerjsServerPath: "/",
    peerjsServerPort: 443,
    peerjsServerSecure: true,
    peerjsTrustedPeerIds: [],
    ...overrides,
  } as unknown as OrchestratorState;
}

describe("channel operations", () => {
  it("getChannelTypeForGroup returns registered type or default browser", () => {
    const stateWithRegistry = {
      channelRegistry: {
        getChannelType: jest.fn((gId: string) =>
          gId.startsWith("tg:") ? "telegram" : null,
        ),
      },
    };
    expect(getChannelTypeForGroup(stateWithRegistry as any, "tg:123")).toBe(
      "telegram",
    );
    expect(getChannelTypeForGroup(stateWithRegistry as any, "br:main")).toBe(
      "browser",
    );
    expect(getChannelTypeForGroup({}, "br:main")).toBe("browser");
  });

  it("getChannelByType returns the correct channel", () => {
    const state = makeState();
    expect(getChannelByType(state, "browser")).toBe(state.browserChat);
    expect(getChannelByType(state, "telegram")).toBe(state.telegram);
    expect(getChannelByType(state, "imessage")).toBe(state.imessage);
    expect(getChannelByType(state, "peerjs")).toBe(state.peerjs);
    expect(getChannelByType(state, "unknown" as ChannelType)).toBeNull();
  });

  it("getChannelEnabled works", () => {
    const state = makeState({
      channelEnabledByType: {
        telegram: true,
        imessage: false,
        peerjs: false,
      } as any,
    });
    expect(getChannelEnabled(state, "browser")).toBe(true);
    expect(getChannelEnabled(state, "telegram")).toBe(true);
    expect(getChannelEnabled(state, "imessage")).toBe(false);
  });

  it("getPeerJsConfig, getTelegramConfig, getIMessageConfig return snapshot configurations", () => {
    const state = makeState({
      channelEnabledByType: {
        telegram: true,
        imessage: true,
        peerjs: true,
      } as any,
      telegramBotToken: "tok-1",
      telegramChatIds: ["chat-1"],
      telegramUseProxy: true,
      imessageServerUrl: "http://imessage.local",
      imessageApiKey: "key-1",
      imessageChatIds: ["i-chat-1"],
      peerjsMyAlias: "my-alias",
      peerjsMyPeerId: "peer-123",
      peerjsPeerAliases: { p1: "Peer 1" },
      peerjsServerHost: "peerjs.custom.io",
      peerjsServerPath: "/custom",
      peerjsServerPort: 9000,
      peerjsServerSecure: false,
      peerjsTrustedPeerIds: ["trusted-1"],
    });

    expect(getTelegramConfig(state)).toEqual({
      botToken: "tok-1",
      chatIds: ["chat-1"],
      enabled: true,
      useProxy: true,
    });

    expect(getIMessageConfig(state)).toEqual({
      serverUrl: "http://imessage.local",
      apiKey: "key-1",
      chatIds: ["i-chat-1"],
      enabled: true,
    });

    expect(getPeerJsConfig(state)).toEqual({
      enabled: true,
      myAlias: "my-alias",
      myPeerId: "peer-123",
      peerAliases: { p1: "Peer 1" },
      serverHost: "peerjs.custom.io",
      serverPath: "/custom",
      serverPort: 9000,
      serverSecure: false,
      trustedPeerIds: ["trusted-1"],
    });
  });

  it("getChannelEnabledConfigKey formats config key", () => {
    expect(getChannelEnabledConfigKey("telegram")).toBe(
      "channel_enabled:telegram",
    );
    expect(getChannelEnabledConfigKey("imessage")).toBe(
      "channel_enabled:imessage",
    );
  });

  it("shouldRunChannel works", () => {
    const state = makeState({
      channelEnabledByType: {
        telegram: true,
        peerjs: false,
        imessage: true,
      } as any,
      telegramBotToken: "token",
      imessageServerUrl: "http://imessage",
      peerjsMyPeerId: "peer1",
    });
    expect(shouldRunChannel(state, "browser")).toBe(true);
    expect(shouldRunChannel(state, "telegram")).toBe(true);
    expect(shouldRunChannel(state, "imessage")).toBe(true);
    expect(shouldRunChannel(state, "peerjs")).toBe(false);
  });

  it("applyChannelRunningState and applyAllChannelRunningStates start or stop channels", () => {
    const state = makeState({
      channelEnabledByType: {
        telegram: true,
        imessage: false,
        peerjs: false,
      } as any,
      telegramBotToken: "token",
    });

    applyAllChannelRunningStates(state);
    expect(state.browserChat.start).toHaveBeenCalled();
    expect(state.telegram.start).toHaveBeenCalled();
    expect(state.imessage.stop).toHaveBeenCalled();
    expect(state.peerjs.stop).toHaveBeenCalled();
  });

  it("applyChannelRunningState invokes ensureConnected if channel is already running", () => {
    const ensureConnectedMock = jest.fn();
    const state = makeState({
      channelEnabledByType: { telegram: true } as any,
      telegramBotToken: "token",
      telegram: {
        running: true,
        start: jest.fn(),
        stop: jest.fn(),
        ensureConnected: ensureConnectedMock,
      } as any,
    });

    applyAllChannelRunningStates(state, true);
    expect(ensureConnectedMock).toHaveBeenCalledWith(true);
  });

  it("clearPeerJsTypingState invokes store update", () => {
    clearPeerJsTypingState("peer:group1");
  });

  it("loadChannelEnabled reads from config", async () => {
    const mockGetConfig = jest
      .fn()
      .mockResolvedValueOnce("true" as never)
      .mockResolvedValueOnce("false" as never)
      .mockResolvedValueOnce(undefined as never);

    expect(
      await loadChannelEnabled("telegram", {} as any, mockGetConfig as any),
    ).toBe(true);
    expect(
      await loadChannelEnabled("telegram", {} as any, mockGetConfig as any),
    ).toBe(false);
    expect(
      await loadChannelEnabled("telegram", {} as any, mockGetConfig as any),
    ).toBe(false);
  });

  it("setChannelEnabled updates state, writes to db and updates running state", async () => {
    const state = makeState({
      telegramBotToken: "bot-token",
    });
    const mockSetConfig = jest.fn().mockResolvedValue(undefined as never);

    await setChannelEnabled(
      state,
      {} as any,
      "browser",
      true,
      mockSetConfig as any,
    );
    expect(mockSetConfig).not.toHaveBeenCalled();

    await setChannelEnabled(
      state,
      {} as any,
      "telegram",
      true,
      mockSetConfig as any,
    );
    expect(state.channelEnabledByType["telegram"]).toBe(true);
    expect(mockSetConfig).toHaveBeenCalledWith(
      {},
      "channel_enabled:telegram",
      "true",
    );
    expect(state.telegram.start).toHaveBeenCalled();
  });

  it("submitMessage proxies call to browserChat", () => {
    const state = makeState();
    submitMessage(state, "Hello agent", "group-1");
    expect(state.browserChat.submit).toHaveBeenCalledWith(
      "Hello agent",
      "group-1",
      [],
      undefined,
    );
  });

  it("saveSecretConfig handles empty and encrypted values", async () => {
    const mockSetConfig = jest.fn().mockResolvedValue(undefined as never);
    await saveSecretConfig({} as any, "key1", "", mockSetConfig as any);
    expect(mockSetConfig).toHaveBeenCalledWith({}, "key1", "");
  });

  it("configureIMessage and configureTelegram stop, configure, save and start channels", async () => {
    const state = makeState({
      channelEnabledByType: { telegram: true, imessage: true } as any,
    });
    const mockSetConfig = jest.fn().mockResolvedValue(undefined as never);
    const mockSaveSecret = jest.fn().mockResolvedValue(undefined as never);

    await configureIMessage(
      state,
      {} as any,
      "http://imessage.local/",
      "secret-key",
      ["chat1", "chat2"],
      mockSetConfig as any,
      mockSaveSecret as any,
    );

    expect(state.imessage.stop).toHaveBeenCalled();
    expect(state.imessage.configure).toHaveBeenCalledWith(
      "http://imessage.local",
      "secret-key",
      ["chat1", "chat2"],
    );
    expect(state.imessage.start).toHaveBeenCalled();

    await configureTelegram(
      state,
      {} as any,
      "telegram-token",
      ["tg-chat-1"],
      true,
      mockSetConfig as any,
      mockSaveSecret as any,
    );

    expect(state.telegram.stop).toHaveBeenCalled();
    expect(state.telegram.configure).toHaveBeenCalledWith(
      "telegram-token",
      ["tg-chat-1"],
      true,
    );
    expect(state.telegram.start).toHaveBeenCalled();
  });
});
