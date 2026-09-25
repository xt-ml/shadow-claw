import { describe, it, expect, beforeEach } from "@jest/globals";
import { resolveCorsProxy } from "./resolveCorsProxy.js";
import { setHeadlessMode } from "../../../../config/headless.js";

describe("resolveCorsProxy", () => {
  let mockDb: any;
  let mockDeps: any;
  let configStore: Record<string, string>;

  beforeEach(() => {
    configStore = {};
    mockDb = {};
    mockDeps = {
      configKeys: {
        GIT_CORS_PROXY: "git_cors_proxy",
        GIT_PROXY_URL: "git_proxy_url",
      },
      getConfig: async (_db: any, key: string) => configStore[key],
      getProxyUrl: (pref: string, custom?: string) => {
        if (pref === "custom") return custom || "https://custom.proxy";
        if (pref === "public") return "https://public.proxy";
        return "http://127.0.0.1:8888/git-proxy";
      },
    };
  });

  it("returns local proxy URL in browser mode by default", async () => {
    setHeadlessMode(false);
    const result = await resolveCorsProxy(mockDb, mockDeps);
    expect(result).toBe("http://127.0.0.1:8888/git-proxy");
  });

  it("returns undefined in headless mode by default to enable direct network access", async () => {
    setHeadlessMode(true);
    const result = await resolveCorsProxy(mockDb, mockDeps);
    expect(result).toBeUndefined();
  });

  it("respects explicit custom proxy URL even in headless mode", async () => {
    setHeadlessMode(true);
    configStore["git_cors_proxy"] = "custom";
    configStore["git_proxy_url"] = "https://my-proxy.internal";
    const result = await resolveCorsProxy(mockDb, mockDeps);
    expect(result).toBe("https://my-proxy.internal");
  });

  it("returns public proxy URL when configured in browser mode", async () => {
    setHeadlessMode(false);
    configStore["git_cors_proxy"] = "public";
    const result = await resolveCorsProxy(mockDb, mockDeps);
    expect(result).toBe("https://public.proxy");
  });
});
