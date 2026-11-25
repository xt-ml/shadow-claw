import { describe, expect, it, jest } from "@jest/globals";

import { createLanguageRegistry } from "./language-registry.js";

describe("createLanguageRegistry", () => {
  it("loads a registered language once and caches the result", async () => {
    const load = jest.fn(async () => undefined);
    const registry = createLanguageRegistry();
    registry.register({ id: "json", load });

    expect(await registry.ensure("json")).toBe(true);
    expect(await registry.ensure("json")).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("shares one in-flight load between concurrent callers", async () => {
    const load = jest.fn(async () => undefined);
    const registry = createLanguageRegistry();
    registry.register({ id: "css", load });

    await Promise.all([registry.ensure("css"), registry.ensure("css")]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("loads dependencies before the language itself", async () => {
    const order: string[] = [];
    const registry = createLanguageRegistry();
    registry.register({
      id: "mermaid",
      load: async () => void order.push("mermaid"),
    });
    registry.register({
      id: "markdown",
      dependencies: ["mermaid"],
      load: async () => void order.push("markdown"),
    });

    await registry.ensure("markdown");
    expect(order).toEqual(["mermaid", "markdown"]);
  });

  it("tolerates dependency cycles", async () => {
    const registry = createLanguageRegistry();
    registry.register({ id: "a", dependencies: ["b"], load: async () => {} });
    registry.register({ id: "b", dependencies: ["a"], load: async () => {} });

    await expect(registry.ensure("a")).resolves.toBe(true);
  });

  it("resolves false for unknown languages (plaintext fallback)", async () => {
    const registry = createLanguageRegistry();

    expect(await registry.ensure("nope")).toBe(false);
    expect(registry.has("nope")).toBe(false);
  });

  it("reports load failures, resolves false, and allows a retry", async () => {
    const onError = jest.fn();
    let attempts = 0;
    const registry = createLanguageRegistry({ onError });
    registry.register({
      id: "flaky",
      load: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("boom");
        }
      },
    });

    expect(await registry.ensure("flaky")).toBe(false);
    expect(onError).toHaveBeenCalledWith("flaky", expect.any(Error));
    expect(await registry.ensure("flaky")).toBe(true);
  });

  it("supports registering support for future languages", async () => {
    const registry = createLanguageRegistry();
    registry.register({ id: "future", load: async () => {} });

    expect(registry.has("future")).toBe(true);
    expect(registry.ids()).toContain("future");
  });
});
