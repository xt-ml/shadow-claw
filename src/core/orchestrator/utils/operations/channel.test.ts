import { jest } from "@jest/globals";

import {
  applyChannelRunningState,
  getChannelByType,
  getChannelEnabled,
  shouldRunChannel,
} from "./channel.js";

import type { ChannelType } from "../../../../subsystems/channels/types.js";
import type { OrchestratorState } from "../../orchestrator-state.js";

function makeState(overrides: Partial<OrchestratorState> = {}) {
  return {
    browserChat: { start: jest.fn(), stop: jest.fn() } as any,
    telegram: { start: jest.fn(), stop: jest.fn() } as any,
    imessage: { start: jest.fn(), stop: jest.fn() } as any,
    peerjs: { start: jest.fn(), stop: jest.fn() } as any,
    channelEnabledByType: { telegram: false, imessage: false, peerjs: false },
    telegramBotToken: "",
    imessageServerUrl: "",
    peerjsMyPeerId: "",
    ...overrides,
  } as unknown as OrchestratorState;
}

describe("channel operations", () => {
  it("getChannelByType returns the correct channel", () => {
    const state = makeState();
    expect(getChannelByType(state, "browser")).toBe(state.browserChat);
    expect(getChannelByType(state, "telegram")).toBe(state.telegram);
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

  it("shouldRunChannel works", () => {
    const state = makeState({
      channelEnabledByType: { telegram: true },
      telegramBotToken: "token",
    });
    expect(shouldRunChannel(state, "browser")).toBe(true);
    expect(shouldRunChannel(state, "telegram")).toBe(true);
    expect(shouldRunChannel(state, "peerjs")).toBe(false);
  });

  it("applyChannelRunningState starts when shouldRunChannel is true", () => {
    const state = makeState();
    applyChannelRunningState(state, "browser");
    expect(state.browserChat.start).toHaveBeenCalled();
  });
});
