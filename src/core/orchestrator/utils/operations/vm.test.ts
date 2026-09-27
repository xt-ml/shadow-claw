import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { DEFAULT_GROUP_ID } from "../../../../config/config.js";

const mockDefaultSetConfig = jest.fn() as any;

jest.unstable_mockModule("../../../../db/setConfig.js", () => ({
  setConfig: mockDefaultSetConfig,
}));

const {
  closeTerminalSession,
  openTerminalSession,
  sendTerminalInput,
  syncTerminalWorkspace,
  flushTerminalWorkspace,
  answerUserPrompt,
  setVMBootMode,
  setVMBootHost,
  setVMNetworkRelayURL,
} = await import("./vm.js");

import type { OrchestratorState } from "../../orchestrator-state.js";

function makeState(withWorker = true) {
  return {
    agentWorker: withWorker ? ({ postMessage: jest.fn() } as any) : undefined,
    vmBootMode: "auto",
  } as unknown as OrchestratorState;
}

describe("vm operations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDefaultSetConfig.mockResolvedValue(undefined);
  });

  it("openTerminalSession sends open message with default and custom groupId", () => {
    const state = makeState();
    openTerminalSession(state, "group1");
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { groupId: "group1" },
      type: "vm-terminal-open",
    });

    openTerminalSession(state);
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { groupId: DEFAULT_GROUP_ID },
      type: "vm-terminal-open",
    });
  });

  it("closeTerminalSession sends close message with default and custom groupId", () => {
    const state = makeState();
    closeTerminalSession(state, "group1");
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { groupId: "group1" },
      type: "vm-terminal-close",
    });

    closeTerminalSession(state);
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { groupId: DEFAULT_GROUP_ID },
      type: "vm-terminal-close",
    });
  });

  it("sendTerminalInput sends input message", () => {
    const state = makeState();
    sendTerminalInput(state, "ls");
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { data: "ls" },
      type: "vm-terminal-input",
    });
  });

  it("syncTerminalWorkspace sends sync message with default and custom groupId", () => {
    const state = makeState();
    syncTerminalWorkspace(state, "group-sync");
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { groupId: "group-sync" },
      type: "vm-workspace-sync",
    });

    syncTerminalWorkspace(state);
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { groupId: DEFAULT_GROUP_ID },
      type: "vm-workspace-sync",
    });
  });

  it("flushTerminalWorkspace sends flush message with default and custom groupId", () => {
    const state = makeState();
    flushTerminalWorkspace(state, "group-flush");
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { groupId: "group-flush" },
      type: "vm-workspace-flush",
    });

    flushTerminalWorkspace(state);
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { groupId: DEFAULT_GROUP_ID },
      type: "vm-workspace-flush",
    });
  });

  it("answerUserPrompt sends ask-user-response message", () => {
    const state = makeState();
    answerUserPrompt(state, "prompt-1", "user accepted");
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { id: "prompt-1", response: "user accepted" },
      type: "ask-user-response",
    });
  });

  it("setVMBootMode sets mode, updates config and notifies worker", async () => {
    const state = makeState();
    const mockSetConfig = jest.fn().mockResolvedValue(undefined as never);

    await setVMBootMode(state, {} as any, "9p", mockSetConfig as any);
    expect(state.vmBootMode).toBe("9p");
    expect(mockSetConfig).toHaveBeenCalledWith({}, "vm_boot_mode", "9p");
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { mode: "9p" },
      type: "set-vm-mode",
    });

    // Test invalid mode normalisation to 'disabled'
    await setVMBootMode(
      state,
      {} as any,
      "invalid-mode" as any,
      mockSetConfig as any,
    );
    expect(state.vmBootMode).toBe("disabled");
    expect(mockSetConfig).toHaveBeenCalledWith({}, "vm_boot_mode", "disabled");

    // Test other valid modes: ext2, auto, disabled
    await setVMBootMode(state, {} as any, "ext2", mockSetConfig as any);
    expect(state.vmBootMode).toBe("ext2");

    await setVMBootMode(state, {} as any, "auto", mockSetConfig as any);
    expect(state.vmBootMode).toBe("auto");

    await setVMBootMode(state, {} as any, "disabled", mockSetConfig as any);
    expect(state.vmBootMode).toBe("disabled");
  });

  it("setVMBootMode uses default setConfig and handles absent agentWorker", async () => {
    const state = makeState(false);
    await setVMBootMode(state, {} as any, "auto");
    expect(mockDefaultSetConfig).toHaveBeenCalledWith(
      {},
      "vm_boot_mode",
      "auto",
    );
  });

  it("setVMBootHost sets boot host, updates config and notifies worker", async () => {
    const state = makeState();
    const mockSetConfig = jest.fn().mockResolvedValue(undefined as never);

    await setVMBootHost(
      state,
      {} as any,
      "  https://v86.example.com  ",
      mockSetConfig as any,
    );
    expect(mockSetConfig).toHaveBeenCalledWith(
      {},
      "vm_boot_host",
      "https://v86.example.com",
    );
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { bootHost: "https://v86.example.com" },
      type: "set-vm-mode",
    });
  });

  it("setVMBootHost handles non-string host, default setConfig, and absent agentWorker", async () => {
    const state = makeState(false);
    await setVMBootHost(state, {} as any, null as any);
    expect(mockDefaultSetConfig).toHaveBeenCalledWith({}, "vm_boot_host", "");
  });

  it("setVMNetworkRelayURL sets relay URL, updates config and notifies worker", async () => {
    const state = makeState();
    const mockSetConfig = jest.fn().mockResolvedValue(undefined as never);

    await setVMNetworkRelayURL(
      state,
      {} as any,
      " wss://relay.example.com ",
      mockSetConfig as any,
    );
    expect(mockSetConfig).toHaveBeenCalledWith(
      {},
      "vm_network_relay_url",
      "wss://relay.example.com",
    );
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { networkRelayUrl: "wss://relay.example.com" },
      type: "set-vm-mode",
    });
  });

  it("setVMNetworkRelayURL handles non-string relay URL, default setConfig, and absent agentWorker", async () => {
    const state = makeState(false);
    await setVMNetworkRelayURL(state, {} as any, undefined as any);
    expect(mockDefaultSetConfig).toHaveBeenCalledWith(
      {},
      "vm_network_relay_url",
      "",
    );
  });
});
