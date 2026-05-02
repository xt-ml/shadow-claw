export class ShadowClawDialog extends HTMLElement {
  private _dialog: HTMLDialogElement | null = null;

  static get observedAttributes(): string[] {
    return ["dialog-class", "aria-label", "aria-labelledby"];
  }

  connectedCallback(): void {
    this.ensureDialog();
  }

  attributeChangedCallback(): void {
    this.syncDialogAttributes();
  }

  showModal(): void {
    this.ensureDialog();
    this._dialog?.showModal();
  }

  close(returnValue?: string): void {
    this._dialog?.close(returnValue);
  }

  get open(): boolean {
    return this._dialog?.open ?? false;
  }

  get returnValue(): string {
    return this._dialog?.returnValue ?? "";
  }

  set returnValue(value: string) {
    if (this._dialog) {
      this._dialog.returnValue = value;
    }
  }

  get dialog(): HTMLDialogElement | null {
    return this._dialog;
  }

  private ensureDialog(): void {
    if (this._dialog) {
      this.syncDialogAttributes();

      return;
    }

    this.style.display = "contents";

    const dialog = document.createElement("dialog");
    this._dialog = dialog;
    this.syncDialogAttributes();

    const template = this.querySelector(":scope > template");
    if (template instanceof HTMLTemplateElement) {
      dialog.appendChild(template.content.cloneNode(true));
      this.appendChild(dialog);

      return;
    }

    while (this.firstChild) {
      dialog.appendChild(this.firstChild);
    }

    this.appendChild(dialog);
  }

  private syncDialogAttributes(): void {
    if (!this._dialog) {
      return;
    }

    const dialogClass = this.getAttribute("dialog-class") || "";
    this._dialog.className = dialogClass;

    const ariaLabel = this.getAttribute("aria-label");
    if (ariaLabel) {
      this._dialog.setAttribute("aria-label", ariaLabel);
    } else {
      this._dialog.removeAttribute("aria-label");
    }

    const ariaLabelledBy = this.getAttribute("aria-labelledby");
    if (ariaLabelledBy) {
      this._dialog.setAttribute("aria-labelledby", ariaLabelledBy);
    } else {
      this._dialog.removeAttribute("aria-labelledby");
    }
  }
}

if (!customElements.get("shadow-claw-dialog")) {
  customElements.define("shadow-claw-dialog", ShadowClawDialog);
}
