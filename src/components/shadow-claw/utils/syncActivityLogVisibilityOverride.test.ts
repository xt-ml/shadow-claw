import { jest } from "@jest/globals";

import { syncActivityLogVisibilityOverride } from "./syncActivityLogVisibilityOverride.js";

describe("syncActivityLogVisibilityOverride", () => {
  let shadowRoot: ShadowRoot;

  beforeEach(() => {
    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
  });

  it("should return early if shadowRoot is null", () => {
    // Should not throw
    syncActivityLogVisibilityOverride(null, true);
  });

  it("should return early if chat component is not found", () => {
    // Should not throw
    syncActivityLogVisibilityOverride(shadowRoot, true);
  });

  it("should call setActivityLogCollapsedOverride on chat component", () => {
    const chat = document.createElement("shadow-claw-chat") as any;
    chat.setActivityLogCollapsedOverride = jest.fn();
    shadowRoot.appendChild(chat);

    syncActivityLogVisibilityOverride(shadowRoot, true);
    expect(chat.setActivityLogCollapsedOverride).toHaveBeenCalledWith(true);

    syncActivityLogVisibilityOverride(shadowRoot, false);
    expect(chat.setActivityLogCollapsedOverride).toHaveBeenCalledWith(false);

    syncActivityLogVisibilityOverride(shadowRoot, null);
    expect(chat.setActivityLogCollapsedOverride).toHaveBeenCalledWith(null);
  });

  it("should not throw if setActivityLogCollapsedOverride is not a function", () => {
    const chat = document.createElement("shadow-claw-chat") as any;
    chat.setActivityLogCollapsedOverride = "not a function";
    shadowRoot.appendChild(chat);

    // Should not throw
    syncActivityLogVisibilityOverride(shadowRoot, true);
  });
});
