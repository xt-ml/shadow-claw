import ShadowClawElement from "../../shadow-claw-element.js";

const elementName = "shadow-claw-actions";

type ActionKind = "account" | "connection";

export class ShadowClawActions extends ShadowClawElement {
  static componentPath = `components/common/${elementName}`;
  static styles = `${ShadowClawActions.componentPath}/${elementName}.css`;
  static template = `${ShadowClawActions.componentPath}/${elementName}.html`;

  static observedAttributes = ["kind", "item-id", "is-default"];

  attributeChangedCallback() {
    this.render();
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

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

customElements.define(elementName, ShadowClawActions);
