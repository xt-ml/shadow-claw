import { jest } from "@jest/globals";

import {
  closeTerminalSession,
  openTerminalSession,
  sendTerminalInput,
} from "./vm.js";

import type { OrchestratorState } from "../../orchestrator-state.js";

function makeState() {
  return {
    agentWorker: { postMessage: jest.fn() } as any,
  } as unknown as OrchestratorState;
}

describe("vm operations", () => {
  it("openTerminalSession sends open message", () => {
    const state = makeState();
    openTerminalSession(state, "group1");
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { groupId: "group1" },
      type: "vm-terminal-open",
    });
  });

  it("closeTerminalSession sends close message", () => {
    const state = makeState();
    closeTerminalSession(state, "group1");
    expect(state.agentWorker?.postMessage).toHaveBeenCalledWith({
      payload: { groupId: "group1" },
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
});
