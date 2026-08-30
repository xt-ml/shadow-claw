import { jest } from "@jest/globals";
import { resolveChildIds } from "./resolveChildIds.js";

describe("resolveChildIds", () => {
  it("returns fixed string array as-is", () => {
    const children = ["child1", "child2", "child3"];
    expect(resolveChildIds(children, {})).toEqual([
      "child1",
      "child2",
      "child3",
    ]);
  });

  it("handles template specification object and generates dynamic IDs", () => {
    const template = { path: "/items", componentId: "item" };
    const dataModel = { items: ["apple", "banana", "cherry"] };
    expect(resolveChildIds(template, dataModel)).toEqual([
      "item_0",
      "item_1",
      "item_2",
    ]);
  });

  it("handles array containing a single template object", () => {
    const children = [{ path: "/users", componentId: "user_card" }] as any;
    const dataModel = { users: [{ name: "Alice" }, { name: "Bob" }] };
    expect(resolveChildIds(children, dataModel)).toEqual([
      "user_card_0",
      "user_card_1",
    ]);
  });

  it("handles array containing nested component objects with IDs", () => {
    const children = [
      { id: "comp1", component: "Text" },
      { id: "comp2", component: "Button" },
    ] as any;
    expect(resolveChildIds(children, {})).toEqual(["comp1", "comp2"]);
  });

  it("returns empty array for nested component objects without IDs", () => {
    const children = [{ component: "Text" }] as any;
    expect(resolveChildIds(children, {})).toEqual([]);
  });

  it("warns and returns empty array if template path does not resolve to an array", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const template = { path: "/notAnArray", componentId: "item" };
    const dataModel = { notAnArray: "string value" };

    expect(resolveChildIds(template, dataModel)).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'ChildList template path "/notAnArray" did not resolve to an array.',
      ),
    );
    warnSpy.mockRestore();
  });

  it("handles empty array gracefully", () => {
    expect(resolveChildIds([], {})).toEqual([]);
  });
});
