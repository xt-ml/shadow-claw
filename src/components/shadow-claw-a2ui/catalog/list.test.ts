import { jest } from "@jest/globals";
import { renderList } from "./list.js";
import type { ListSpec } from "../../../ui/a2ui.js";

describe("renderList", () => {
  it("renders a vertical list by default with weight and children", () => {
    const spec: ListSpec = {
      id: "test-list",
      component: "List",
      weight: 2,
      children: ["child-1", "child-2"],
    };

    const mockChildEl1 = document.createElement("span");
    const mockChildEl2 = document.createElement("div");

    const ctx = {
      renderComponent: jest.fn((id: string) => {
        if (id === "child-1") return mockChildEl1;
        if (id === "child-2") return mockChildEl2;
        return null;
      }) as any,
    };

    const el = renderList(spec, {} as any, ctx);

    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("a2ui__list a2ui__list--vertical");
    expect(el.style.flexGrow).toBe("2");

    expect(ctx.renderComponent).toHaveBeenCalledTimes(2);
    expect(el.children.length).toBe(2);
    expect(el.children[0].className).toBe("a2ui__list-item");
    expect(el.children[0].contains(mockChildEl1)).toBe(true);
    expect(el.children[1].className).toBe("a2ui__list-item");
    expect(el.children[1].contains(mockChildEl2)).toBe(true);
  });

  it("renders a horizontal list when specified", () => {
    const spec: ListSpec = {
      id: "test-list-2",
      component: "List",
      direction: "horizontal",
      children: [],
    };

    const ctx = {
      renderComponent: jest.fn() as any,
    };

    const el = renderList(spec, {} as any, ctx);

    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("a2ui__list a2ui__list--horizontal");
    expect(el.children.length).toBe(0);
  });

  it("handles null components in children gracefully", () => {
    const spec: ListSpec = {
      id: "test-list-3",
      component: "List",
      children: ["child-1"],
    };

    const ctx = {
      renderComponent: jest.fn().mockReturnValue(null) as any,
    };

    const el = renderList(spec, {} as any, ctx);

    expect(el.children.length).toBe(0);
  });
});
