import { jest } from "@jest/globals";
import { renderColumn } from "./column.js";
import type { ColumnSpec } from "../../../ui/a2ui.js";

describe("renderColumn", () => {
  it("renders a column with basic attributes and children", () => {
    const spec: ColumnSpec = {
      id: "test-col",
      component: "Column",
      weight: 3,
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

    const el = renderColumn(spec, {} as any, ctx);

    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("a2ui__column");
    expect(el.style.flexGrow).toBe("3");

    expect(ctx.renderComponent).toHaveBeenCalledTimes(2);
    expect(el.children.length).toBe(2);
    expect(el.contains(mockChildEl1)).toBe(true);
    expect(el.contains(mockChildEl2)).toBe(true);
  });

  it("adds justify and align classes when specified", () => {
    const spec: ColumnSpec = {
      id: "test-col-2",
      component: "Column",
      justify: "end",
      align: "center",
      children: [],
    };

    const ctx = {
      renderComponent: jest.fn() as any,
    };

    const el = renderColumn(spec, {} as any, ctx);

    expect(el.tagName).toBe("DIV");
    expect(el.classList.contains("a2ui__column")).toBe(true);
    expect(el.classList.contains("a2ui__justify--end")).toBe(true);
    expect(el.classList.contains("a2ui__align--center")).toBe(true);
  });

  it("handles null child components gracefully", () => {
    const spec: ColumnSpec = {
      id: "test-col-3",
      component: "Column",
      children: ["child-1"],
    };

    const ctx = {
      renderComponent: jest.fn().mockReturnValue(null) as any,
    };

    const el = renderColumn(spec, {} as any, ctx);

    expect(el.children.length).toBe(0);
  });
});
