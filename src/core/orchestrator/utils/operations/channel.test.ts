import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { DEFAULT_GROUP_ID } from "../../../../config/config.js";
import type { MessageAttachment } from "../../../../content/types.js";
import type { ShadowClawDatabase } from "../../../../db/db.js";
import type {
  Channel,
  ChannelType,
} from "../../../../subsystems/channels/types.js";
import type { OrchestratorState } from "../../orchestrator-state.js";

const mockDefaultSetConfig =
  jest.fn<
    (_db: ShadowClawDatabase, _key: string, _val: string) => Promise<void>
  >();
const mockDefaultGetConfig =
  jest.fn<
    (_db: ShadowClawDatabase, _key: string) => Promise<string | undefined>
  >();
const mockEncryptValue = jest.fn<(val: string) => Promise<string | null>>();
const mockDecryptValue = jest.fn<(val: string) => Promise<string | null>>();
const mockSetRemoteAgentTyping =
  jest.fn<(groupId: string, typing: boolean) => void>();

jest.unstable_mockModule("../../../../db/setConfig.js", () => ({
  setConfig: mockDefaultSetConfig,
}));

jest.unstable_mockModule("../../../../db/getConfig.js", () => ({
  getConfig: mockDefaultGetConfig,
}));

jest.unstable_mockModule("../../../../security/crypto.js", () => ({
  encryptValue: mockEncryptValue,
  decryptValue: mockDecryptValue,
}));

jest.unstable_mockModule("../../../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    setRemoteAgentTyping: mockSetRemoteAgentTyping,
  },
}));

const {
  applyAllChannelRunningStates,
  applyChannelRunningState,
  clearPeerJsTypingState,
  configureIMessage,
  configureTelegram,
  getChannelByType,
  getChannelEnabled,
  getChannelEnabledConfigKey,
  getChannelTypeForGroup,
  getIMessageConfig,
  getPeerJsConfig,
  getTelegramConfig,
  loadChannelEnabled,
  saveSecretConfig,
  setChannelEnabled,
  shouldRunChannel,
  submitMessage,
} = await import("./channel.js");

interface MockChannel extends Channel {
  ensureConnected?: (force: boolean) => void;
}

function makeChannel(
  running = false,
  ensureConnected?: (force: boolean) => void,
): MockChannel {
  const ch: MockChannel = {
    running,
    start: jest.fn(),
    stop: jest.fn(),
    submit: jest.fn(),
    configure: jest.fn(),
  } as unknown as MockChannel;
  if (ensureConnected) {
    ch.ensureConnected = ensureConnected;
  }
  return ch;
}

interface MockOrchestratorState {
  browserChat: MockChannel;
  telegram: MockChannel;
  imessage: MockChannel;
  peerjs: MockChannel;
  channelEnabledByType: Partial<Record<ChannelType, boolean>>;
  telegramBotToken: string;
  telegramChatIds: string[];
  telegramUseProxy: boolean;
  imessageServerUrl: string;
  imessageApiKey: string;
  imessageChatIds: string[];
  peerjsMyAlias: string;
  peerjsMyPeerId: string;
  peerjsPeerAliases: Record<string, string>;
  peerjsServerHost: string;
  peerjsServerPath: string;
  peerjsServerPort: number;
  peerjsServerSecure: boolean;
  peerjsTrustedPeerIds: string[];
}

function makeState(overrides: Partial<MockOrchestratorState> = {}) {
  const defaultChannelEnabled: Record<ChannelType, boolean> = {
    browser: true,
    telegram: false,
    imessage: false,
    peerjs: false,
    room: false,
  };
  const base: MockOrchestratorState = {
    browserChat: makeChannel(),
    telegram: makeChannel(),
    imessage: makeChannel(),
    peerjs: makeChannel(),
    channelEnabledByType: { ...defaultChannelEnabled },
    telegramBotToken: "",
    telegramChatIds: [] as string[],
    telegramUseProxy: false,
    imessageServerUrl: "",
    imessageApiKey: "",
    imessageChatIds: [] as string[],
    peerjsMyAlias: "",
    peerjsMyPeerId: "",
    peerjsPeerAliases: {},
    peerjsServerHost: "0.peerjs.com",
    peerjsServerPath: "/",
    peerjsServerPort: 443,
    peerjsServerSecure: true,
    peerjsTrustedPeerIds: [] as string[],
  };
  const merged = Object.assign(base, overrides);
  if (overrides.channelEnabledByType) {
    merged.channelEnabledByType = {
      ...defaultChannelEnabled,
      ...overrides.channelEnabledByType,
    };
  }
  return merged as unknown as OrchestratorState;
}

describe("channel operations", () => {
  const mockDb = {} as ShadowClawDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDefaultSetConfig.mockResolvedValue(undefined);
    mockDefaultGetConfig.mockResolvedValue(undefined);
    mockEncryptValue.mockImplementation(async (val) => `enc:${val}`);
  });

  it("getChannelTypeForGroup returns registered type or default browser", () => {
    const stateWithRegistry = {
      channelRegistry: {
        getChannelType: (gId: string) =>
          gId.startsWith("tg:") ? ("telegram" as ChannelType) : null,
      },
    };
    expect(getChannelTypeForGroup(stateWithRegistry, "tg:123")).toBe(
      "telegram",
    );
    expect(getChannelTypeForGroup(stateWithRegistry, "br:main")).toBe(
      "browser",
    );
    expect(getChannelTypeForGroup({}, "br:main")).toBe("browser");
  });

  it("getChannelByType returns the correct channel or null for unknown", () => {
    const state = makeState();
    expect(getChannelByType(state, "browser")).toBe(state.browserChat);
    expect(getChannelByType(state, "telegram")).toBe(state.telegram);
    expect(getChannelByType(state, "imessage")).toBe(state.imessage);
    expect(getChannelByType(state, "peerjs")).toBe(state.peerjs);
    expect(getChannelByType(state, "unknown" as ChannelType)).toBeNull();
  });

  it("getChannelEnabled returns true for browser and checks map for others", () => {
    const state = makeState({
      channelEnabledByType: {
        telegram: true,
        imessage: false,
        peerjs: false,
      },
    });
    expect(getChannelEnabled(state, "browser")).toBe(true);
    expect(getChannelEnabled(state, "telegram")).toBe(true);
    expect(getChannelEnabled(state, "imessage")).toBe(false);
  });

  it("getChannelEnabledConfigKey formats key properly", () => {
    expect(getChannelEnabledConfigKey("telegram")).toBe(
      "channel_enabled:telegram",
    );
  });

  it("getTelegramConfig, getIMessageConfig, and getPeerJsConfig return current config", () => {
    const state = makeState({
      telegramBotToken: "tok",
      telegramChatIds: ["tg1"],
      telegramUseProxy: true,
      imessageServerUrl: "http://imsg",
      imessageApiKey: "key",
      imessageChatIds: ["im1"],
      peerjsMyAlias: "alias",
      peerjsMyPeerId: "peer1",
      peerjsPeerAliases: { p2: "a2" },
      peerjsServerHost: "host",
      peerjsServerPath: "/p",
      peerjsServerPort: 9000,
      peerjsServerSecure: false,
      peerjsTrustedPeerIds: ["trust1"],
    });

    expect(getTelegramConfig(state)).toEqual({
      botToken: "tok",
      chatIds: ["tg1"],
      enabled: false,
      useProxy: true,
    });

    expect(getIMessageConfig(state)).toEqual({
      apiKey: "key",
      chatIds: ["im1"],
      enabled: false,
      serverUrl: "http://imsg",
    });

    expect(getPeerJsConfig(state)).toEqual({
      enabled: false,
      myAlias: "alias",
      myPeerId: "peer1",
      peerAliases: { p2: "a2" },
      serverHost: "host",
      serverPath: "/p",
      serverPort: 9000,
      serverSecure: false,
      trustedPeerIds: ["trust1"],
    });
  });

  it("shouldRunChannel evaluates readiness for each channel type", () => {
    const state = makeState({
      channelEnabledByType: {
        telegram: true,
        imessage: true,
        peerjs: true,
        custom: true,
      } as unknown as Record<ChannelType, boolean>,
      telegramBotToken: "tok",
      imessageServerUrl: "http://imsg",
      peerjsMyPeerId: "peer1",
    });

    expect(shouldRunChannel(state, "browser")).toBe(true);
    expect(shouldRunChannel(state, "telegram")).toBe(true);
    expect(shouldRunChannel(state, "imessage")).toBe(true);
    expect(shouldRunChannel(state, "peerjs")).toBe(true);
    expect(shouldRunChannel(state, "custom" as ChannelType)).toBe(true);

    // When disabled
    const disabledState = makeState();
    expect(shouldRunChannel(disabledState, "telegram")).toBe(false);

    // When enabled but missing token/url/id
    const incompleteState = makeState({
      channelEnabledByType: {
        telegram: true,
        imessage: true,
        peerjs: true,
      },
    });
    expect(shouldRunChannel(incompleteState, "telegram")).toBe(false);
    expect(shouldRunChannel(incompleteState, "imessage")).toBe(false);
    expect(shouldRunChannel(incompleteState, "peerjs")).toBe(false);
  });

  it("applyChannelRunningState handles null channel, starting, stopping, and ensureConnected", () => {
    const state = makeState();

    // Unknown channel does nothing
    expect(() =>
      applyChannelRunningState(state, "unknown" as ChannelType),
    ).not.toThrow();

    // Not running and should run -> starts channel
    state.channelEnabledByType.telegram = true;
    state.telegramBotToken = "token";
    applyChannelRunningState(state, "telegram");
    expect(state.telegram.start).toHaveBeenCalled();

    // Already running and should run -> calls ensureConnected if present
    const ensureMock = jest.fn();
    const runningTelegram = makeChannel(true, ensureMock);
    const runningState = makeState({
      channelEnabledByType: { telegram: true, imessage: false, peerjs: false },
      telegramBotToken: "token",
      telegram: runningTelegram,
    });

    applyChannelRunningState(runningState, "telegram", true);
    expect(ensureMock).toHaveBeenCalledWith(true);

    // Running but should not run -> stops channel
    const shouldStopTelegram = makeChannel(true);
    const stopState = makeState({
      telegram: shouldStopTelegram,
    });
    applyChannelRunningState(stopState, "telegram");
    expect(shouldStopTelegram.stop).toHaveBeenCalled();
  });

  it("applyAllChannelRunningStates applies state across all remote channels", () => {
    const state = makeState({
      channelEnabledByType: { telegram: true, imessage: false, peerjs: false },
      telegramBotToken: "token",
    });

    applyAllChannelRunningStates(state);
    expect(state.telegram.start).toHaveBeenCalled();
  });

  it("clearPeerJsTypingState clears typing indicators on orchestratorStore", () => {
    mockSetRemoteAgentTyping.mockClear();
    clearPeerJsTypingState("group-123");
    expect(mockSetRemoteAgentTyping).toHaveBeenCalledWith("group-123", false);
  });

  it("loadChannelEnabled uses default getConfig or passed getConfig", async () => {
    mockDefaultGetConfig.mockResolvedValueOnce("true");
    const loadedDefault = await loadChannelEnabled("telegram", mockDb);
    expect(loadedDefault).toBe(true);

    const customGetConfig = jest
      .fn<
        (_db: ShadowClawDatabase, _key: string) => Promise<string | undefined>
      >()
      .mockResolvedValue("false");
    const loadedCustom = await loadChannelEnabled(
      "imessage",
      mockDb,
      customGetConfig,
    );
    expect(loadedCustom).toBe(false);

    const loadedMissing = await loadChannelEnabled(
      "telegram",
      mockDb,
      async () => undefined,
    );
    expect(loadedMissing).toBe(false);

    const loadedEmpty = await loadChannelEnabled(
      "telegram",
      mockDb,
      async () => "",
    );
    expect(loadedEmpty).toBe(false);
  });

  it("setChannelEnabled uses default setConfig or passed setConfig", async () => {
    const state = makeState();
    await setChannelEnabled(state, mockDb, "telegram", true);
    expect(state.channelEnabledByType.telegram).toBe(true);
    expect(mockDefaultSetConfig).toHaveBeenCalledWith(
      mockDb,
      "channel_enabled:telegram",
      "true",
    );

    const customSetConfig = jest
      .fn<
        (_db: ShadowClawDatabase, _key: string, _val: string) => Promise<void>
      >()
      .mockResolvedValue(undefined);
    await setChannelEnabled(state, mockDb, "imessage", false, customSetConfig);
    expect(state.channelEnabledByType.imessage).toBe(false);
    expect(customSetConfig).toHaveBeenCalledWith(
      mockDb,
      "channel_enabled:imessage",
      "false",
    );

    // channelType === "browser" returns early without setting config
    mockDefaultSetConfig.mockClear();
    await setChannelEnabled(state, mockDb, "browser", true);
    expect(mockDefaultSetConfig).not.toHaveBeenCalled();
  });

  it("submitMessage proxies call to browserChat with explicit and default arguments", () => {
    const state = makeState();
    const attachments: MessageAttachment[] = [];
    submitMessage(state, "Hello agent", "group-1", attachments);
    expect(state.browserChat.submit).toHaveBeenCalledWith(
      "Hello agent",
      "group-1",
      attachments,
      undefined,
    );

    submitMessage(state, "Default params test");
    expect(state.browserChat.submit).toHaveBeenCalledWith(
      "Default params test",
      DEFAULT_GROUP_ID,
      [],
      undefined,
    );
  });

  it("applyChannelRunningState handles running channel without ensureConnected", () => {
    const state = makeState({
      telegram: makeChannel(true),
      channelEnabledByType: { telegram: true, imessage: false, peerjs: false },
      telegramBotToken: "tok",
    });
    applyChannelRunningState(state, "telegram");
    expect(state.telegram.start).not.toHaveBeenCalled();
  });

  it("saveSecretConfig handles empty, encrypted values, and encryption errors", async () => {
    const mockSetConfig = jest
      .fn<
        (_db: ShadowClawDatabase, _key: string, _val: string) => Promise<void>
      >()
      .mockResolvedValue(undefined);

    // Empty value clears config
    await saveSecretConfig(mockDb, "key1", "", mockSetConfig);
    expect(mockSetConfig).toHaveBeenCalledWith(mockDb, "key1", "");

    // Non-empty value encrypts and sets config
    await saveSecretConfig(mockDb, "key2", "super-secret", mockSetConfig);
    expect(mockEncryptValue).toHaveBeenCalledWith("super-secret");
    expect(mockSetConfig).toHaveBeenCalledWith(
      mockDb,
      "key2",
      "enc:super-secret",
    );

    // Uses default setConfig when omitted
    await saveSecretConfig(mockDb, "key3", "val");
    expect(mockDefaultSetConfig).toHaveBeenCalledWith(
      mockDb,
      "key3",
      "enc:val",
    );

    // Throws if encryptValue returns null/empty
    mockEncryptValue.mockResolvedValueOnce(null);
    await expect(
      saveSecretConfig(mockDb, "key4", "failed-val"),
    ).rejects.toThrow("Failed to encrypt secret config for key4");
  });

  it("configureIMessage and configureTelegram use custom and default configs", async () => {
    const state = makeState({
      channelEnabledByType: { telegram: true, imessage: true, peerjs: false },
    });
    const mockSetConfig = jest
      .fn<
        (_db: ShadowClawDatabase, _key: string, _val: string) => Promise<void>
      >()
      .mockResolvedValue(undefined);
    const mockSaveSecret = jest
      .fn<
        (_db: ShadowClawDatabase, _key: string, _val: string) => Promise<void>
      >()
      .mockResolvedValue(undefined);

    await configureIMessage(
      state,
      mockDb,
      "http://imessage.local/",
      "secret-key",
      ["chat1", "chat2"],
      mockSetConfig,
      mockSaveSecret,
    );

    expect(state.imessage.stop).toHaveBeenCalled();
    expect(state.imessage.configure).toHaveBeenCalledWith(
      "http://imessage.local",
      "secret-key",
      ["chat1", "chat2"],
    );
    expect(state.imessage.start).toHaveBeenCalled();

    // configureIMessage with defaults and empty url
    const stateImDisabled = makeState({
      channelEnabledByType: { telegram: false, imessage: false, peerjs: false },
    });
    await configureIMessage(stateImDisabled, mockDb, "", "", []);
    expect(stateImDisabled.imessage.start).not.toHaveBeenCalled();

    // configureIMessage with url but channel disabled
    await configureIMessage(stateImDisabled, mockDb, "http://imsg.local", "k", [
      "c",
    ]);
    expect(stateImDisabled.imessage.start).not.toHaveBeenCalled();

    await configureTelegram(
      state,
      mockDb,
      "telegram-token",
      ["tg-chat-1"],
      true,
      mockSetConfig,
      mockSaveSecret,
    );

    expect(state.telegram.stop).toHaveBeenCalled();
    expect(state.telegram.configure).toHaveBeenCalledWith(
      "telegram-token",
      ["tg-chat-1"],
      true,
    );
    expect(state.telegram.start).toHaveBeenCalled();

    // Call configureTelegram with defaults and empty token
    const stateTgDisabled = makeState({
      channelEnabledByType: { telegram: false, imessage: false, peerjs: false },
    });
    await configureTelegram(stateTgDisabled, mockDb, "", []);
    expect(stateTgDisabled.telegram.start).not.toHaveBeenCalled();

    // Call configureTelegram with token but channel disabled
    await configureTelegram(stateTgDisabled, mockDb, "valid-token", ["chat"]);
    expect(stateTgDisabled.telegram.start).not.toHaveBeenCalled();
  });
});
