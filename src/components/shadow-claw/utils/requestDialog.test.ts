import { jest } from "@jest/globals";

import { requestDialog } from "./requestDialog.js";

describe("requestDialog", () => {
  let doc: Document;
  let shadowRoot: ShadowRoot;
  let dialog: HTMLDialogElement;
  let titleEl: HTMLElement;
  let messageEl: HTMLElement;
  let detailsEl: HTMLUListElement;
  let linksEl: HTMLDivElement;
  let confirmBtn: HTMLButtonElement;
  let cancelBtn: HTMLButtonElement;

  beforeEach(() => {
    doc = document;
    shadowRoot = doc.createElement("div").attachShadow({ mode: "open" });

    dialog = doc.createElement("dialog");
    dialog.className = "app-dialog";
    // Mock showModal and close
    dialog.showModal = jest.fn();
    dialog.close = jest.fn();

    titleEl = doc.createElement("div");
    titleEl.className = "app-dialog__title";

    messageEl = doc.createElement("div");
    messageEl.className = "app-dialog__message";

    detailsEl = doc.createElement("ul");
    detailsEl.className = "app-dialog__details";

    linksEl = doc.createElement("div");
    linksEl.className = "app-dialog__links";

    confirmBtn = doc.createElement("button");
    confirmBtn.className = "app-dialog__btn--confirm";

    cancelBtn = doc.createElement("button");
    cancelBtn.className = "app-dialog__btn--cancel";

    dialog.append(
      titleEl,
      messageEl,
      detailsEl,
      linksEl,
      confirmBtn,
      cancelBtn,
    );
    shadowRoot.append(dialog);
  });

  it("should return false if shadowRoot is not provided", async () => {
    const result = await requestDialog(doc, null, { title: "t", message: "m" });
    expect(result).toBe(false);
  });

  it("should return false if required elements are missing", async () => {
    shadowRoot.innerHTML = "";
    const result = await requestDialog(doc, shadowRoot, {
      title: "t",
      message: "m",
    });
    expect(result).toBe(false);
  });

  it("should populate the dialog and return true on confirm", async () => {
    const p = requestDialog(doc, shadowRoot, {
      title: "Test Title",
      message: "Test Message",
      details: ["detail 1"],
      links: [{ href: "http://test", label: "Test Link" }],
      confirmLabel: "Yes",
      cancelLabel: "No",
    });

    expect(titleEl.textContent).toBe("Test Title");
    expect(messageEl.textContent).toBe("Test Message");
    expect(detailsEl.hidden).toBe(false);
    expect(detailsEl.children.length).toBe(1);
    expect(detailsEl.children[0].textContent).toBe("detail 1");
    expect(linksEl.hidden).toBe(false);
    expect(linksEl.children.length).toBe(1);
    expect(linksEl.children[0].textContent).toBe("Test Link");
    expect(confirmBtn.textContent).toBe("Yes");
    expect(cancelBtn.textContent).toBe("No");
    expect(dialog.showModal).toHaveBeenCalled();

    // simulate confirm
    dialog.returnValue = "confirm";
    dialog.dispatchEvent(new Event("close"));

    const result = await p;
    expect(result).toBe(true);
  });

  it("should handle missing details and links", async () => {
    const p = requestDialog(doc, shadowRoot, {
      title: "T",
      message: "M",
    });

    expect(detailsEl.hidden).toBe(true);
    expect(linksEl.hidden).toBe(true);

    dialog.returnValue = "";
    dialog.dispatchEvent(new Event("close"));
    const result = await p;
    expect(result).toBe(false);
  });

  it("should handle mode='info'", async () => {
    const p = requestDialog(doc, shadowRoot, {
      title: "T",
      message: "M",
      mode: "info",
    });

    expect(confirmBtn.textContent).toBe("OK");
    expect(cancelBtn.hidden).toBe(true);

    dialog.returnValue = "confirm";
    dialog.dispatchEvent(new Event("close"));
    const result = await p;
    expect(result).toBe(true);
  });

  it("should close the dialog if already open", () => {
    Object.defineProperty(dialog, "open", { value: true, configurable: true });
    requestDialog(doc, shadowRoot, { title: "T", message: "M" });
    expect(dialog.close).toHaveBeenCalled();
  });
});
