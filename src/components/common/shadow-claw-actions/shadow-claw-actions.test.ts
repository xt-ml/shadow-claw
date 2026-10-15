import { jest } from "@jest/globals";

const { ShadowClawActions } = await import("./shadow-claw-actions.js");

describe("shadow-claw-actions", () => {
  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-actions")).toBe(ShadowClawActions);
  });

  it("renders account actions and emits action event", async () => {
    const el = new ShadowClawActions();
    el.setAttribute("kind", "account");
    el.setAttribute("item-id", "acct-1");

    const listener = jest.fn();
    el.addEventListener("settings-action", listener as EventListener);

    document.body.appendChild(el);
    await el.render();

    const editBtn = el.shadowRoot?.querySelector(
      'button[data-action="edit-account"]',
    );
    if (editBtn instanceof HTMLButtonElement) {
      editBtn.click();
    }

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      action: "edit-account",
      id: "acct-1",
    });

    el.remove();
  });

  it("renders connection actions and default account actions", async () => {
    const el = new ShadowClawActions();
    el.setAttribute("kind", "connection");
    el.setAttribute("item-id", "conn-1");
    document.body.appendChild(el);
    await el.connectedCallback();

    const buttons = el.shadowRoot?.querySelectorAll("button");
    expect(buttons?.length).toBe(3);
    expect(buttons?.[0]?.getAttribute("data-action")).toBe("test-connection");
    expect(buttons?.[2]?.classList.contains("delete-btn")).toBe(true);

    // Switch to account with is-default
    el.setAttribute("kind", "account");
    el.setAttribute("is-default", "");
    el.attributeChangedCallback();

    const acctButtons = el.shadowRoot?.querySelectorAll("button");
    // When is-default, set-default button is omitted (2 buttons)
    expect(acctButtons?.length).toBe(2);
    expect(acctButtons?.[0]?.getAttribute("data-action")).toBe("edit-account");

    el.remove();
  });

  it("handles click events on non-buttons or buttons without action/id", async () => {
    const el = new ShadowClawActions();
    document.body.appendChild(el);
    await el.connectedCallback();

    const listener = jest.fn();
    el.addEventListener("settings-action", listener as EventListener);

    // Click on container (not button)
    const container = el.shadowRoot?.querySelector(".actions");
    container?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(listener).not.toHaveBeenCalled();

    // Click on button when item-id is not set
    const btn = el.shadowRoot?.querySelector("button");
    btn?.click();
    expect(listener).not.toHaveBeenCalled();

    // Click on button with no data-action
    el.setAttribute("item-id", "id-1");
    btn?.removeAttribute("data-action");
    btn?.click();
    expect(listener).not.toHaveBeenCalled();

    el.remove();
  });

  it("handles early returns when shadowRoot or container is missing", async () => {
    const el = new ShadowClawActions();
    Object.defineProperty(el, "shadowRoot", {
      value: null,
      configurable: true,
    });
    await expect(el.render()).resolves.toBeUndefined();

    const el2 = new ShadowClawActions();
    el2.shadowRoot?.querySelector(".actions")?.remove();
    await expect(el2.render()).resolves.toBeUndefined();
  });
});
