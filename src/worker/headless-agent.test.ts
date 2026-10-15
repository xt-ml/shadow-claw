import { describe, expect, it } from "@jest/globals";
import * as headlessAgent from "./headless-agent.js";

describe("headless-agent", () => {
  it("exports core headless agent APIs and tools", () => {
    expect(typeof headlessAgent.executeTool).toBe("function");
    expect(typeof headlessAgent.executeToolChain).toBe("function");
    expect(typeof headlessAgent.handleInvoke).toBe("function");
    expect(typeof headlessAgent.post).toBe("function");
    expect(typeof headlessAgent.setPostHandler).toBe("function");
    expect(typeof headlessAgent.setHeadlessMode).toBe("function");
    expect(typeof headlessAgent.isHeadlessMode).toBe("function");
    expect(typeof headlessAgent.nativeBashExecutor).toBe("function");
    expect(typeof headlessAgent.nativeEvalExecutor).toBe("function");
    expect(typeof headlessAgent.nativePeerClientFactory).toBe("function");
  });

  it("exports configuration and storage utilities", () => {
    expect(typeof headlessAgent.getProvider).toBe("function");
    expect(typeof headlessAgent.getDefaultProvider).toBe("function");
    expect(typeof headlessAgent.openSqliteDatabase).toBe("function");
    expect(typeof headlessAgent.closeSqliteDatabase).toBe("function");
    expect(typeof headlessAgent.setStorageRootFromPath).toBe("function");
    expect(typeof headlessAgent.discoverSkills).toBe("function");
    expect(typeof headlessAgent.loadSkill).toBe("function");
    expect(Array.isArray(headlessAgent.TOOL_DEFINITIONS)).toBe(true);
  });
});
