import { jest } from "@jest/globals";
import {
  ShadowClawResizeHandle,
  clampSize,
  computeKeyboardResize,
  getResizeHandleAriaAttributes,
} from "./shadow-claw-resize-handle.js";

describe("shadow-claw-resize-handle", () => {
  describe("pure helpers", () => {
    it("clampSize clamps values, defaults NaN to min, and handles numeric strings", () => {
      expect(clampSize(250, 100, 500)).toBe(250);
      expect(clampSize(20, 100, 500)).toBe(100);
      expect(clampSize(999, 100, 500)).toBe(500);
      expect(clampSize("320", 100, 500)).toBe(320);
      expect(clampSize("not-a-number", 120, 500)).toBe(120);
    });

    it("computeKeyboardResize supports arrows, Shift acceleration, Home/End, and invert", () => {
      expect(
        computeKeyboardResize("ArrowRight", false, 200, 100, 400, 10),
      ).toBe(210);
      expect(computeKeyboardResize("ArrowDown", true, 200, 100, 400, 10)).toBe(
        250,
      );
      expect(computeKeyboardResize("ArrowLeft", false, 200, 100, 400, 10)).toBe(
        190,
      );
      expect(computeKeyboardResize("ArrowUp", true, 200, 100, 400, 10)).toBe(
        150,
      );
      expect(computeKeyboardResize("Home", false, 200, 100, 400, 10)).toBe(100);
      expect(computeKeyboardResize("End", false, 200, 100, 400, 10)).toBe(400);

      // Inverted direction (right/bottom panels)
      expect(
        computeKeyboardResize("ArrowRight", false, 200, 100, 400, 10, true),
      ).toBe(190);
      expect(
        computeKeyboardResize("ArrowLeft", false, 200, 100, 400, 10, true),
      ).toBe(210);
      expect(
        computeKeyboardResize("Home", false, 200, 100, 400, 10, true),
      ).toBe(400);
      expect(computeKeyboardResize("End", false, 200, 100, 400, 10, true)).toBe(
        100,
      );

      // Unhandled key returns current unchanged
      expect(computeKeyboardResize("Enter", false, 200, 100, 400, 10)).toBe(
        200,
      );
    });

    it("getResizeHandleAriaAttributes produces WCAG separator attributes", () => {
      expect(
        getResizeHandleAriaAttributes("horizontal", 180.4, 80, 360, "Timeline"),
      ).toEqual({
        role: "separator",
        tabindex: "0",
        "aria-orientation": "horizontal",
        "aria-valuenow": "180",
        "aria-valuemin": "80",
        "aria-valuemax": "360",
        "aria-label": "Timeline",
      });
    });
  });

  describe("custom element", () => {
    it("registers shadow-claw-resize-handle and attaches open shadowRoot with separator semantics", () => {
      expect(customElements.get("shadow-claw-resize-handle")).toBe(
        ShadowClawResizeHandle,
      );

      const el = new ShadowClawResizeHandle();
      el.setAttribute("orientation", "horizontal");
      el.setAttribute("min", "100");
      el.setAttribute("max", "500");
      el.setAttribute("value", "240");
      el.setAttribute("label", "Resize timeline");
      document.body.appendChild(el);

      const handle = el.shadowRoot?.querySelector(
        '[part="handle"]',
      ) as HTMLElement | null;
      const indicator = el.shadowRoot?.querySelector(
        '[part="indicator"]',
      ) as HTMLElement | null;

      expect(el.shadowRoot).not.toBeNull();
      expect(handle?.getAttribute("role")).toBe("separator");
      expect(handle?.getAttribute("tabindex")).toBe("0");
      expect(handle?.getAttribute("aria-orientation")).toBe("horizontal");
      expect(handle?.getAttribute("aria-valuenow")).toBe("240");
      expect(handle?.getAttribute("aria-valuemin")).toBe("100");
      expect(handle?.getAttribute("aria-valuemax")).toBe("500");
      expect(handle?.getAttribute("aria-label")).toBe("Resize timeline");
      expect(handle?.classList.contains("resize-handle--horizontal")).toBe(
        true,
      );
      expect(indicator?.getAttribute("aria-hidden")).toBe("true");

      el.remove();
    });

    it("syncs attributes dynamically via attributeChangedCallback", () => {
      const el = new ShadowClawResizeHandle();
      document.body.appendChild(el);

      el.setAttribute("orientation", "horizontal");
      el.setAttribute("min", "120");
      el.setAttribute("max", "480");
      el.setAttribute("value", "300");
      el.setAttribute("label", "Bottom drawer");

      const handle = el.shadowRoot?.querySelector('[part="handle"]');
      expect(handle?.getAttribute("aria-orientation")).toBe("horizontal");
      expect(handle?.getAttribute("aria-valuenow")).toBe("300");
      expect(handle?.getAttribute("aria-valuemin")).toBe("120");
      expect(handle?.getAttribute("aria-valuemax")).toBe("480");
      expect(handle?.getAttribute("aria-label")).toBe("Bottom drawer");
      expect(handle?.classList.contains("resize-handle--horizontal")).toBe(
        true,
      );

      el.remove();
    });

    it("handles pointer dragging, invert/direction='reverse', and emits shadow-claw-resize + shadow-claw-resize-end", () => {
      const el = new ShadowClawResizeHandle();
      el.setAttribute("orientation", "vertical");
      el.setAttribute("min", "100");
      el.setAttribute("max", "500");
      el.setAttribute("value", "200");
      el.setAttribute("direction", "reverse");
      document.body.appendChild(el);

      const handle = el.shadowRoot?.querySelector(
        '[part="handle"]',
      ) as HTMLElement;
      handle.setPointerCapture = jest.fn();
      handle.releasePointerCapture = jest.fn();

      const resizeEvents: CustomEvent[] = [];
      const endEvents: CustomEvent[] = [];
      el.addEventListener("shadow-claw-resize", (e) =>
        resizeEvents.push(e as CustomEvent),
      );
      el.addEventListener("shadow-claw-resize-end", (e) =>
        endEvents.push(e as CustomEvent),
      );

      const makePointerEvent = (
        type: string,
        coords: { clientX: number; clientY: number },
      ) => {
        const ev = new Event(type, { bubbles: true, cancelable: true }) as any;
        ev.clientX = coords.clientX;
        ev.clientY = coords.clientY;
        ev.pointerId = 1;
        return ev;
      };

      handle.dispatchEvent(
        makePointerEvent("pointerdown", { clientX: 300, clientY: 10 }),
      );
      expect(handle.classList.contains("resize-handle--active")).toBe(true);

      // Dragging left by 40px with reverse direction increases value by 40
      handle.dispatchEvent(
        makePointerEvent("pointermove", { clientX: 260, clientY: 10 }),
      );
      expect(el.getAttribute("value")).toBe("240");
      expect(handle.getAttribute("aria-valuenow")).toBe("240");
      expect(resizeEvents).toHaveLength(1);
      expect(resizeEvents[0].detail).toEqual({
        value: 240,
        delta: 40,
        rawDelta: -40,
        orientation: "vertical",
        invert: true,
      });

      handle.dispatchEvent(
        makePointerEvent("pointerup", { clientX: 260, clientY: 10 }),
      );
      expect(handle.classList.contains("resize-handle--active")).toBe(false);
      expect(endEvents).toHaveLength(1);
      expect(endEvents[0].detail).toEqual({
        value: 240,
        orientation: "vertical",
        invert: true,
      });

      el.remove();
    });

    it("supports keyboard navigation with accurate delta = next - prev", () => {
      const el = new ShadowClawResizeHandle();
      el.setAttribute("min", "100");
      el.setAttribute("max", "500");
      el.setAttribute("value", "200");
      el.setAttribute("step", "12");
      document.body.appendChild(el);

      const handle = el.shadowRoot?.querySelector(
        '[part="handle"]',
      ) as HTMLElement;
      const resizeEvents: CustomEvent[] = [];
      el.addEventListener("shadow-claw-resize", (e) =>
        resizeEvents.push(e as CustomEvent),
      );

      handle.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      expect(el.getAttribute("value")).toBe("212");
      expect(resizeEvents[0].detail.delta).toBe(12);

      handle.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          shiftKey: true,
          bubbles: true,
        }),
      );
      expect(el.getAttribute("value")).toBe("272");
      expect(resizeEvents[1].detail.delta).toBe(60);

      handle.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
      );
      expect(el.getAttribute("value")).toBe("100");
      expect(resizeEvents[2].detail.delta).toBe(-172);

      el.remove();
    });

    it("respects disabled attribute and does not duplicate listeners across reconnects", () => {
      const el = new ShadowClawResizeHandle();
      el.setAttribute("value", "200");
      document.body.appendChild(el);
      el.remove();
      document.body.appendChild(el);

      const handle = el.shadowRoot?.querySelector(
        '[part="handle"]',
      ) as HTMLElement;
      const resizeEvents: CustomEvent[] = [];
      el.addEventListener("shadow-claw-resize", (e) =>
        resizeEvents.push(e as CustomEvent),
      );

      // Single keydown fires only once even after disconnect/reconnect
      handle.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      expect(resizeEvents).toHaveLength(1);

      // Disabled ignores interactions and updates ARIA
      el.setAttribute("disabled", "");
      expect(handle.getAttribute("aria-disabled")).toBe("true");
      expect(handle.getAttribute("tabindex")).toBe("-1");

      handle.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      expect(resizeEvents).toHaveLength(1);

      el.remove();
    });
  });
});
