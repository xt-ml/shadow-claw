import { jest } from "@jest/globals";
import { DEFAULT_GROUP_ID } from "../../../../config/config.js";

import {
  closeTerminalSession,
  openTerminalSession,
  sendTerminalInput,
  syncTerminalWorkspace,
  flushTerminalWorkspace,
  answerUserPrompt,
  setVMBootMode,
  setVMBootHost,
  setVMNetworkRelayURL,
} from "./vm.js";

import type { OrchestratorState } from "../../orchestrator-state.js";

function makeState() {
  return {
    agentWorker: { postMessage: jest.fn() } as any,
    vmBootMode: "auto",
  } as unknown as OrchestratorState;
}

describe("vm operations", () => {
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

  it("syncTerminalWorkspace sends sync message", () => {
    const state = makeState();
    syncTerminalWorkspace(state, "group-sync");
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { groupId: "group-sync" },
      type: "vm-workspace-sync",
    });
  });

  it("flushTerminalWorkspace sends flush message", () => {
    const state = makeState();
    flushTerminalWorkspace(state, "group-flush");
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { groupId: "group-flush" },
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
});
