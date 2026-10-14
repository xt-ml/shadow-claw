import { jest } from "@jest/globals";
import { getAgentCore } from "./agent-core.js";

describe("agent-core", () => {
  it("loads and caches the headless-agent core module", async () => {
    const core1 = await getAgentCore();
    expect(core1).toBeDefined();

    // second call should return cached instance
    const core2 = await getAgentCore();
    expect(core2).toBe(core1);
  });

  it("loads from dist when NODE_ENV is not test", async () => {
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      await jest.isolateModulesAsync(async () => {
        const { getAgentCore: isolatedGetAgentCore } =
          await import("./agent-core.js");
        const core = await isolatedGetAgentCore();
        expect(core).toBeDefined();
      });
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it("falls back to dist/headless-agent.js when worker/headless-agent import fails", async () => {
    await jest.isolateModulesAsync(async () => {
      jest.unstable_mockModule("../../worker/headless-agent.js", () => {
        throw new Error("Module failed to load");
      });
      const { getAgentCore: isolatedGetAgentCore } =
        await import("./agent-core.js");
      const core = await isolatedGetAgentCore();
      expect(core).toBeDefined();
    });
  });
});
