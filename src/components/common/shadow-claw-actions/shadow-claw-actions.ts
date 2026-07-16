import ShadowClawElement from "../../shadow-claw-element.js";
import shadowClawActionsStyles from "./shadow-claw-actions.css" with { type: "css" };
import shadowClawActionsTemplate from "./shadow-claw-actions.html" with { type: "html" };

const elementName = "shadow-claw-actions";

type ActionKind = "account" | "connection";

export class ShadowClawActions extends ShadowClawElement {
  static styles = shadowClawActionsStyles;
  static template = shadowClawActionsTemplate;

  attributeChangedCallback() {
    this.render();
  }

  async connectedCallback() {
    this.shadowRoot?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      const action = target.getAttribute("data-action");
      const id = this.getAttribute("item-id");
      if (!action || !id) {
        return;
      }

      this.dispatchEvent(
        new CustomEvent("settings-action", {
          detail: { action, id },
          bubbles: true,
          composed: true,
        }),
      );
    });

    await this.render();
  }

  async render() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const container = root.querySelector(".actions");
    if (!container) {
      return;
    }

    const kind = (this.getAttribute("kind") || "account") as ActionKind;
    const isDefault = this.hasAttribute("is-default");

    container.replaceChildren();

    const makeButton = (action: string, label: string, isDelete = false) => {
      const button = document.createElement("button");
      button.setAttribute("data-action", action);
      button.textContent = label;
      if (isDelete) {
        button.className = "delete-btn";
      }

      return button;
    };

    if (kind === "connection") {
      container.append(
        makeButton("test-connection", "Test"),
        makeButton("edit-connection", "Edit"),
        makeButton("delete-connection", "Delete", true),
      );

      return;
    }

    if (!isDefault) {
      container.append(makeButton("set-default", "Set Default"));
    }

    container.append(
      makeButton("edit-account", "Edit"),
      makeButton("delete-account", "Delete", true),
    );
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawActions);
}
