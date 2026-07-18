import { resolveDynamicString } from "../../../ui/a2ui.js";
import { applyWeight } from "./shared.js";

import type { TabsSpec } from "../../../ui/a2ui.js";
import type { RenderContext, SurfaceState } from "../../types.js";

export function renderTabs(
  spec: TabsSpec,
  surface: SurfaceState,
  ctx: Pick<RenderContext, "renderComponent">,
): HTMLElement {
  const container = document.createElement("div");
  container.className = "a2ui__tabs";
  applyWeight(container, spec.weight);

  const headers = document.createElement("div");
  headers.className = "a2ui__tabs-headers";
  const content = document.createElement("div");
  content.className = "a2ui__tabs-content";

  const tabs = Array.isArray(spec.tabs) ? spec.tabs : [];
  if (!Array.isArray(spec.tabs)) {
    console.warn(
      `[shadow-claw-a2ui] Tab spec is missing or invalid for component id: "${spec.id}"`,
    );
  }

  const activate = (index: number) => {
    headers.querySelectorAll("button").forEach((b, i) => {
      b.classList.toggle("active", i === index);
    });
    content.replaceChildren();
    const childId = tabs[index]?.child;
    if (childId) {
      const childEl = ctx.renderComponent(childId);
      if (childEl) {
        content.appendChild(childEl);
      }
    }
  };

  tabs.forEach((tab, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "a2ui__tab-header";
    btn.textContent = resolveDynamicString(tab.title, surface.dataModel);
    btn.addEventListener("click", () => activate(index));
    headers.appendChild(btn);
  });

  container.append(headers, content);
  if (tabs.length > 0) {
    activate(0);
  }

  return container;
}
