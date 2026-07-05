import { applyWeight } from "./shared.js";

import type { ModalSpec } from "../../../ui/a2ui.js";
import type { SurfaceState, RenderContext } from "./types.js";

export function renderModal(
  spec: ModalSpec,
  _: SurfaceState,
  ctx: Pick<RenderContext, "renderComponent" | "attachModalOverlay">,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "a2ui__modal";
  applyWeight(wrapper, spec.weight);

  const triggerEl =
    ctx.renderComponent(spec.trigger) ??
    (() => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Open";

      return button;
    })();

  const overlay = document.createElement("div");
  overlay.className = "a2ui__modal-overlay";
  overlay.style.display = "none";
  overlay.setAttribute("role", "dialog");

  const content = document.createElement("div");
  content.className = "a2ui__modal-content";

  const closeOverlay = () => {
    overlay.style.display = "none";
    content.replaceChildren();
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeOverlay();
    }
  });

  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeOverlay();
    }
  });

  overlay.append(content);

  triggerEl.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      content.replaceChildren();
      const childEl = ctx.renderComponent(spec.content);
      if (childEl) {
        content.appendChild(childEl);
      }

      overlay.style.display = "block";
      overlay.tabIndex = -1;
      overlay.focus();
    },
    { capture: true },
  );

  if (ctx.attachModalOverlay) {
    ctx.attachModalOverlay(overlay);
  }

  wrapper.appendChild(triggerEl);

  return wrapper;
}
