import { jest } from "@jest/globals";
import { renderRow } from "./row.js";
import type { RowSpec } from "../../../ui/a2ui.js";

describe("renderRow", () => {
  it("renders a row with basic attributes and children", () => {
    const spec: RowSpec = {
      id: "test-row",
      component: "Row",
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

    const el = renderRow(spec, {} as any, ctx);

    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("a2ui__row");
    expect(el.style.flexGrow).toBe("2");

    expect(ctx.renderComponent).toHaveBeenCalledTimes(2);
    expect(el.children.length).toBe(2);
    expect(el.contains(mockChildEl1)).toBe(true);
    expect(el.contains(mockChildEl2)).toBe(true);
  });

  it("adds justify and align classes when specified", () => {
    const spec: RowSpec = {
      id: "test-row-2",
      component: "Row",
      justify: "center",
      align: "start",
      children: [],
    };

    const ctx = {
      renderComponent: jest.fn() as any,
    };

    const el = renderRow(spec, {} as any, ctx);

    expect(el.tagName).toBe("DIV");
    expect(el.classList.contains("a2ui__row")).toBe(true);
    expect(el.classList.contains("a2ui__justify--center")).toBe(true);
    expect(el.classList.contains("a2ui__align--start")).toBe(true);
  });

  it("handles null child components gracefully", () => {
    const spec: RowSpec = {
      id: "test-row-3",
      component: "Row",
      children: ["child-1"],
    };

    const ctx = {
      renderComponent: jest.fn().mockReturnValue(null) as any,
    };

    const el = renderRow(spec, {} as any, ctx);

    expect(el.children.length).toBe(0);
  });
});
