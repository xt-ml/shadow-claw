import ShadowClawElement, { defineElement } from "../../shadow-claw-element.js";
import shadowClawResizeHandleStyles from "./shadow-claw-resize-handle.css" with { type: "css" };
import shadowClawResizeHandleTemplate from "./shadow-claw-resize-handle.html" with { type: "html" };

const elementName = "shadow-claw-resize-handle";

export type ResizeHandleOrientation = "vertical" | "horizontal";

export interface ResizeHandleEventDetail {
  value: number;
  delta?: number;
  rawDelta?: number;
  orientation: ResizeHandleOrientation;
  invert: boolean;
}

export function clampSize(val: unknown, min = 100, max = 800): number {
  const num = Number(val);
  if (Number.isNaN(num)) {
    return min;
  }

  return Math.max(min, Math.min(max, num));
}

export function computeKeyboardResize(
  key: string,
  shiftKey: boolean,
  current: number,
  min: number,
  max: number,
  step = 10,
  invert = false,
): number {
  const delta = shiftKey ? step * 5 : step;
  const effectiveDelta = invert ? -delta : delta;

  if (key === "ArrowRight" || key === "ArrowDown") {
    return clampSize(current + effectiveDelta, min, max);
  }

  if (key === "ArrowLeft" || key === "ArrowUp") {
    return clampSize(current - effectiveDelta, min, max);
  }

  if (key === "Home") {
    return invert ? max : min;
  }

  if (key === "End") {
    return invert ? min : max;
  }

  return current;
}

export function getResizeHandleAriaAttributes(
  orientation: ResizeHandleOrientation = "vertical",
  val = 240,
  min = 120,
  max = 600,
  label = "Resize panel",
): Record<string, string> {
  return {
    role: "separator",
    tabindex: "0",
    "aria-orientation": orientation,
    "aria-valuenow": String(Math.round(val)),
    "aria-valuemin": String(Math.round(min)),
    "aria-valuemax": String(Math.round(max)),
    "aria-label": label,
  };
}

/**
 * Accessible, touch-friendly split-pane resize handle (<shadow-claw-resize-handle>).
 * Conforms to WCAG 2.1 AA separator semantics with pointer capture, keyboard support,
 * and directional inversion (`invert` / `direction="reverse"`).
 */
export class ShadowClawResizeHandle extends ShadowClawElement {
  static shadowRootOptions: Partial<ShadowRootInit> = {
    delegatesFocus: true,
  };

  static observedAttributes = [
    "orientation",
    "value",
    "min",
    "max",
    "step",
    "label",
    "invert",
    "direction",
    "disabled",
  ];

  static styles = shadowClawResizeHandleStyles;
  static template = shadowClawResizeHandleTemplate;

  private _orientation: ResizeHandleOrientation = "vertical";
  private _value = 240;
  private _min = 120;
  private _max = 600;
  private _step = 10;
  private _label = "Resize vertical panel";
  private _invert = false;
  private _disabled = false;
  private _isDragging = false;
  private _startPos = 0;
  private _startValue = 0;

  connectedCallback(): void {
    this._syncAttributes();
    this.render();
    this._attachListeners();
  }

  disconnectedCallback(): void {
    this._isDragging = false;
    this.shadowRoot
      ?.querySelector(".resize-handle")
      ?.classList.remove("resize-handle--active");
    super.disconnectedCallback();
  }

  attributeChangedCallback(): void {
    this._syncAttributes();
    this.render();
  }

  private _syncAttributes(): void {
    this._orientation =
      this.getAttribute("orientation") === "horizontal"
        ? "horizontal"
        : "vertical";
    const parsedMin = Number(this.getAttribute("min") ?? 120);
    const parsedMax = Number(this.getAttribute("max") ?? 600);
    this._min = Number.isNaN(parsedMin) ? 120 : parsedMin;
    this._max = Number.isNaN(parsedMax) ? 600 : parsedMax;

    const parsedStep = Number(this.getAttribute("step") ?? 10);
    this._step =
      Number.isFinite(parsedStep) && parsedStep > 0 ? parsedStep : 10;

    this._value = clampSize(
      this.getAttribute("value") ?? 240,
      this._min,
      this._max,
    );
    this._label =
      this.getAttribute("label") || `Resize ${this._orientation} panel`;
    this._invert =
      (this.hasAttribute("invert") &&
        this.getAttribute("invert") !== "false") ||
      this.getAttribute("direction") === "reverse";
    this._disabled =
      this.hasAttribute("disabled") &&
      this.getAttribute("disabled") !== "false";
  }

  private _emitResize(nextVal: number, delta: number, rawDelta?: number): void {
    const detail: ResizeHandleEventDetail = {
      value: nextVal,
      delta,
      orientation: this._orientation,
      invert: this._invert,
    };
    if (rawDelta !== undefined) {
      detail.rawDelta = rawDelta;
    }

    this.dispatchEvent(
      new CustomEvent<ResizeHandleEventDetail>("shadow-claw-resize", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  private _attachListeners(): void {
    this.disposeCleanups();
    const handle = this.shadowRoot?.querySelector(
      ".resize-handle",
    ) as HTMLElement | null;
    if (!handle) {
      return;
    }

    const onPointerDown = (e: Event) => {
      if (this._disabled) {
        return;
      }

      const pe = e as PointerEvent;
      pe.preventDefault?.();
      this._isDragging = true;
      handle.classList.add("resize-handle--active");
      this._startPos =
        this._orientation === "vertical" ? pe.clientX : pe.clientY;
      this._startValue = this._value;

      if (
        typeof handle.setPointerCapture === "function" &&
        pe.pointerId !== undefined
      ) {
        try {
          handle.setPointerCapture(pe.pointerId);
        } catch {}
      }
    };

    const onPointerMove = (e: Event) => {
      if (!this._isDragging || this._disabled) {
        return;
      }

      const pe = e as PointerEvent;
      const curPos = this._orientation === "vertical" ? pe.clientX : pe.clientY;
      const rawDelta = curPos - this._startPos;
      const delta = this._invert ? -rawDelta : rawDelta;
      const nextVal = clampSize(this._startValue + delta, this._min, this._max);

      if (nextVal !== this._value) {
        this._value = nextVal;
        this.setAttribute("value", String(nextVal));
        this.render();
        this._emitResize(nextVal, delta, rawDelta);
      }
    };

    const endDrag = (e: Event) => {
      if (!this._isDragging) {
        return;
      }

      const pe = e as PointerEvent;
      this._isDragging = false;
      handle.classList.remove("resize-handle--active");

      if (
        pe &&
        typeof handle.releasePointerCapture === "function" &&
        pe.pointerId !== undefined
      ) {
        try {
          handle.releasePointerCapture(pe.pointerId);
        } catch {}
      }

      this.dispatchEvent(
        new CustomEvent<ResizeHandleEventDetail>("shadow-claw-resize-end", {
          bubbles: true,
          composed: true,
          detail: {
            value: this._value,
            orientation: this._orientation,
            invert: this._invert,
          },
        }),
      );
    };

    const onKeyDown = (e: Event) => {
      if (this._disabled) {
        return;
      }

      const ke = e as KeyboardEvent;
      const next = computeKeyboardResize(
        ke.key,
        ke.shiftKey,
        this._value,
        this._min,
        this._max,
        this._step,
        this._invert,
      );

      if (next !== this._value) {
        ke.preventDefault();
        const prev = this._value;
        this._value = next;
        this.setAttribute("value", String(next));
        this.render();
        this._emitResize(next, next - prev);
      }
    };

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
    handle.addEventListener("keydown", onKeyDown);

    this.addCleanup(() => {
      handle.removeEventListener("pointerdown", onPointerDown);
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", endDrag);
      handle.removeEventListener("pointercancel", endDrag);
      handle.removeEventListener("keydown", onKeyDown);
    });
  }

  render(): void {
    const handle = this.shadowRoot?.querySelector(
      ".resize-handle",
    ) as HTMLElement | null;
    if (!handle) {
      return;
    }

    handle.classList.toggle(
      "resize-handle--vertical",
      this._orientation === "vertical",
    );
    handle.classList.toggle(
      "resize-handle--horizontal",
      this._orientation === "horizontal",
    );

    const attrs = getResizeHandleAriaAttributes(
      this._orientation,
      this._value,
      this._min,
      this._max,
      this._label,
    );
    for (const [k, v] of Object.entries(attrs)) {
      handle.setAttribute(k, v);
    }

    if (this._disabled) {
      handle.setAttribute("aria-disabled", "true");
      handle.setAttribute("tabindex", "-1");
    } else {
      handle.removeAttribute("aria-disabled");
      handle.setAttribute("tabindex", "0");
    }
  }
}

defineElement(elementName, ShadowClawResizeHandle);
