import { jest } from "@jest/globals";
import { normaliseComponentsToMap } from "./normaliseComponentsToMap.js";

describe("normaliseComponentsToMap", () => {
  it("normalises a flat list of component specs", () => {
    const specs = [
      { id: "root", component: "Column", children: ["c1", "c2"] },
      { id: "c1", component: "Text", text: "Hello" },
      { id: "c2", component: "Button", text: "Submit" },
    ] as any;

    const map = normaliseComponentsToMap(specs);
    expect(map["root"]).toEqual(specs[0]);
    expect(map["c1"]).toEqual(specs[1]);
    expect(map["c2"]).toEqual(specs[2]);
  });

  it("walks nested children array objects", () => {
    const specs = [
      {
        id: "root",
        component: "Column",
        children: [
          { id: "nested1", component: "Text", text: "Nested 1" },
          { id: "nested2", component: "Text", text: "Nested 2" },
        ],
      },
    ] as any;

    const map = normaliseComponentsToMap(specs);
    expect(map["root"]).toBeDefined();
    expect(map["nested1"]).toEqual({
      id: "nested1",
      component: "Text",
      text: "Nested 1",
    });
    expect(map["nested2"]).toEqual({
      id: "nested2",
      component: "Text",
      text: "Nested 2",
    });
  });

  it("does not walk children if children[0] is a template specification", () => {
    const specs = [
      {
        id: "root",
        component: "Column",
        children: [{ path: "/items", componentId: "tmpl" }],
      },
    ] as any;

    const map = normaliseComponentsToMap(specs);
    expect(map["root"]).toBeDefined();
    expect(Object.keys(map)).toEqual(["root"]);
  });

  it("walks nested child object and nested tabs", () => {
    const specs = [
      {
        id: "card1",
        component: "Card",
        child: { id: "cardInner", component: "Text", text: "Inside Card" },
      },
      {
        id: "tabs1",
        component: "Tabs",
        tabs: [
          { title: "Tab 1", child: { id: "tabContent1", component: "Text" } },
          { title: "Tab 2", child: { id: "tabContent2", component: "Text" } },
        ],
      },
    ] as any;

    const map = normaliseComponentsToMap(specs);
    expect(map["card1"]).toBeDefined();
    expect(map["cardInner"]).toBeDefined();
    expect(map["tabs1"]).toBeDefined();
    expect(map["tabContent1"]).toBeDefined();
    expect(map["tabContent2"]).toBeDefined();
  });

  it("warns and skips components missing id field", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const specs = [
      null,
      "invalid-primitive" as any,
      { component: "Text", text: "No ID" },
      { customField: 123 },
    ] as any;

    const map = normaliseComponentsToMap(specs);
    expect(map).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Component missing required 'id' field; skipped.",
      ),
      expect.anything(),
    );
    warnSpy.mockRestore();
  });
});
