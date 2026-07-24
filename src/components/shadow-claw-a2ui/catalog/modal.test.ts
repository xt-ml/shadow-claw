import { jest } from "@jest/globals";
import { renderModal } from "./modal.js";
import type { ModalSpec } from "../../../ui/a2ui.js";

describe("renderModal", () => {
  it("renders a default trigger if none is provided in context", () => {
    const spec: ModalSpec = {
      id: "test-modal",
      component: "Modal",
      trigger: "trigger-id",
      content: "content-id",
    };

    const ctx = {
      renderComponent: jest.fn().mockReturnValue(null),
      attachModalOverlay: jest.fn(),
    } as any;

    const el = renderModal(spec, {} as any, ctx);

    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("a2ui__modal");

    const btn = el.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toBe("Open");
  });

  it("renders the specified trigger and opens the overlay on click", () => {
    const spec: ModalSpec = {
      id: "test-modal",
      component: "Modal",
      trigger: "trigger-id",
      content: "content-id",
    };

    const mockTriggerEl = document.createElement("a");
    mockTriggerEl.textContent = "Custom Trigger";

    const mockContentEl = document.createElement("p");
    mockContentEl.textContent = "Modal content here";

    const ctx = {
      renderComponent: jest.fn().mockImplementation((id: any) => {
        if (id === "trigger-id") return mockTriggerEl;
        if (id === "content-id") return mockContentEl;
        return null;
      }),
      attachModalOverlay: jest.fn(),
    } as any;

    const el = renderModal(spec, {} as any, ctx);
    expect(el.contains(mockTriggerEl)).toBe(true);

    const overlay = ctx.attachModalOverlay.mock.calls[0][0] as HTMLElement;
    expect(overlay.style.display).toBe("none");

    mockTriggerEl.click();

    expect(overlay.style.display).toBe("block");
    const contentContainer = overlay.querySelector(".a2ui__modal-content");
    expect(contentContainer?.contains(mockContentEl)).toBe(true);
  });

  it("closes overlay on escape key", () => {
    const spec: ModalSpec = {
      id: "test-modal",
      component: "Modal",
      trigger: "trigger-id",
      content: "content-id",
    };

    const ctx = {
      renderComponent: jest.fn(),
      attachModalOverlay: jest.fn(),
    } as any;

    renderModal(spec, {} as any, ctx);
    const overlay = ctx.attachModalOverlay.mock.calls[0][0] as HTMLElement;

    // Simulate opening it first
    overlay.style.display = "block";

    const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" });
    overlay.dispatchEvent(escapeEvent);

    expect(overlay.style.display).toBe("none");
    expect(overlay.querySelector(".a2ui__modal-content")?.children.length).toBe(
      0,
    );
  });

  it("closes overlay on click outside", () => {
    const spec: ModalSpec = {
      id: "test-modal",
      component: "Modal",
      trigger: "trigger-id",
      content: "content-id",
    };

    const ctx = {
      renderComponent: jest.fn(),
      attachModalOverlay: jest.fn(),
    } as any;

    renderModal(spec, {} as any, ctx);
    const overlay = ctx.attachModalOverlay.mock.calls[0][0] as HTMLElement;

    overlay.style.display = "block";

    // Clicking the overlay itself
    const clickEvent = new MouseEvent("click", { bubbles: true });
    overlay.dispatchEvent(clickEvent);

    expect(overlay.style.display).toBe("none");
  });
});
