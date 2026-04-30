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
    await Promise.all([el.onStylesReady, el.onTemplateReady]);
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
});
