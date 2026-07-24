import { jest } from "@jest/globals";
import { renderButton } from "./button.js";
import type { ButtonSpec } from "../../../ui/a2ui.js";

describe("renderButton", () => {
  it("renders a primary button by default", () => {
    const spec: ButtonSpec = {
      id: "test-btn",
      component: "Button",
      text: "Click Me",
    } as any;

    const ctx = {
      renderComponent: jest.fn(),
      dispatchAction: jest.fn(),
    } as any;

    const el = renderButton(spec, { components: {} } as any, ctx);

    expect(el.tagName).toBe("BUTTON");
    expect(el.className).toBe("a2ui__button a2ui__button--primary");
    expect(el.textContent).toBe("Click Me");
  });

  it("renders a button with checked state", () => {
    const spec: ButtonSpec = {
      id: "test-btn",
      component: "Button",
      checked: true,
      text: "Checked",
    } as any;

    const el = renderButton(spec, { components: {} } as any, {} as any);
    expect(el.classList.contains("a2ui__button--checked")).toBe(true);
  });

  it("renders a child component instead of text", () => {
    const spec: ButtonSpec = {
      id: "test-btn",
      component: "Button",
      child: "child-id",
    } as any;

    const surface = {
      components: {
        "child-id": { id: "child-id", component: "Text", text: "Child" },
      },
    } as any;

    const mockChildEl = document.createElement("span");
    const ctx = {
      renderComponent: jest.fn().mockReturnValue(mockChildEl),
    } as any;

    const el = renderButton(spec, surface, ctx);

    expect(ctx.renderComponent).toHaveBeenCalledWith("child-id");
    expect(el.contains(mockChildEl)).toBe(true);
  });

  it("dispatches action on click", () => {
    const spec: ButtonSpec = {
      id: "test-btn",
      component: "Button",
      action: { id: "action-id" },
    } as any;

    const ctx = {
      dispatchAction: jest.fn(),
    } as any;

    const el = renderButton(spec, { components: {} } as any, ctx);
    el.click();

    expect(ctx.dispatchAction).toHaveBeenCalledWith("action-id");
  });
});
