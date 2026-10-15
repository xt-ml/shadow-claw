import { jest } from "@jest/globals";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getProjectRoot } from "./resolve-project-root.js";
import { getAgentCore } from "./agent-core.js";

const toolchainRoot = getProjectRoot(import.meta.url);
const distAgentPath = path.join(toolchainRoot, "dist/headless-agent.js");
const distAgentUrl = pathToFileURL(distAgentPath).href;

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
        jest.unstable_mockModule("node:fs", async () => {
          const actual = await jest.requireActual<any>("node:fs");
          return {
            ...actual,
            existsSync: (p: any) => {
              if (typeof p === "string" && p.includes("headless-agent.js")) {
                return true;
              }
              return actual.existsSync(p);
            },
          };
        });
        const mockDist = () => ({
          isDistMock: true,
          post: jest.fn(),
        });
        jest.unstable_mockModule(distAgentPath, mockDist, { virtual: true });
        jest.unstable_mockModule(distAgentUrl, mockDist, { virtual: true });
        const { getAgentCore: isolatedGetAgentCore } =
          await import("./agent-core.js");
        const core = await isolatedGetAgentCore();
        expect(core).toBeDefined();
        expect(core.isDistMock).toBe(true);
      });
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it("falls back to dist/headless-agent.js when worker/headless-agent import fails", async () => {
    await jest.isolateModulesAsync(async () => {
      jest.unstable_mockModule("node:fs", async () => {
        const actual = await jest.requireActual<any>("node:fs");
        return {
          ...actual,
          existsSync: (p: any) => {
            if (typeof p === "string" && p.includes("headless-agent.js")) {
              return true;
            }
            return actual.existsSync(p);
          },
        };
      });
      jest.unstable_mockModule("../../worker/headless-agent.js", () => {
        throw new Error("Module failed to load");
      });
      const mockDist = () => ({
        isDistMock: true,
        post: jest.fn(),
      });
      jest.unstable_mockModule(distAgentPath, mockDist, { virtual: true });
      jest.unstable_mockModule(distAgentUrl, mockDist, { virtual: true });
      const { getAgentCore: isolatedGetAgentCore } =
        await import("./agent-core.js");
      const core = await isolatedGetAgentCore();
      expect(core).toBeDefined();
      expect(core.isDistMock).toBe(true);
    });
  });
});
