import { jest } from "@jest/globals";
import { renderCard } from "./card.js";
import type { CardSpec } from "../../../ui/a2ui.js";

describe("renderCard", () => {
  it("renders a card with weight and child component", () => {
    const spec: CardSpec = {
      id: "test-card",
      component: "Card",
      weight: 2,
      child: "child-1",
    };

    const mockChildEl = document.createElement("span");
    const ctx = {
      renderComponent: jest.fn().mockReturnValue(mockChildEl) as any,
    };

    const el = renderCard(spec, {} as any, ctx);

    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("a2ui__card");
    expect(el.style.flexGrow).toBe("2");

    expect(ctx.renderComponent).toHaveBeenCalledWith("child-1");
    expect(el.contains(mockChildEl)).toBe(true);
  });

  it("handles missing child gracefully", () => {
    const spec: CardSpec = {
      id: "test-card-2",
      component: "Card",
      child: "child-2",
    };

    const ctx = {
      renderComponent: jest.fn().mockReturnValue(null) as any,
    };

    const el = renderCard(spec, {} as any, ctx);

    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("a2ui__card");
    expect(el.children.length).toBe(0);
  });
});
