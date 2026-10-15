import {
  ComponentRegistry,
  globalComponentRegistry,
} from "./component-registry.js";

describe("component-registry", () => {
  it("registers and retrieves component renderers", () => {
    const registry = new ComponentRegistry();
    const renderer = () => document.createElement("div");

    registry.register("test-component", renderer);
    expect(registry.get("test-component")).toBe(renderer);
    expect(registry.get("non-existent")).toBeUndefined();
  });

  it("provides globalComponentRegistry instance", () => {
    expect(globalComponentRegistry).toBeInstanceOf(ComponentRegistry);
  });
});
