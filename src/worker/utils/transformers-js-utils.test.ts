import { jest } from "@jest/globals";
import {
  getHuggingFaceDomain,
  isRemoteEnvironment,
} from "./transformers-js-utils.js";

describe("transformers-js-utils", () => {
  describe("isRemoteEnvironment", () => {
    it("returns false in local jsdom environment", () => {
      expect(isRemoteEnvironment()).toBe(false);
    });
  });

  describe("getHuggingFaceDomain", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("returns cached domain if already resolved", async () => {
      const domain = await getHuggingFaceDomain();
      expect(domain).toBe("huggingface.co");
    });

    it("switches to mirror when main domain is unreachable", async () => {
      globalThis.fetch = jest
        .fn<any>()
        .mockImplementation(async (url: string) => {
          if (url.includes("huggingface.co")) {
            throw new Error("Network error");
          }
          return { ok: true };
        });

      let mod: any;
      await jest.isolateModulesAsync(async () => {
        mod = await import("./transformers-js-utils.js");
      });

      const domain = await mod.getHuggingFaceDomain();
      expect(domain).toBe("hf-mirror.com");
    });

    it("falls back to main domain when both are unreachable", async () => {
      globalThis.fetch = jest
        .fn<any>()
        .mockRejectedValue(new Error("Both down"));

      let mod: any;
      await jest.isolateModulesAsync(async () => {
        mod = await import("./transformers-js-utils.js");
      });

      const domain = await mod.getHuggingFaceDomain();
      expect(domain).toBe("huggingface.co");
    });
  });
});
