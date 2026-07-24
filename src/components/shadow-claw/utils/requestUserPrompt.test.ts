import { jest } from "@jest/globals";

import { requestUserPrompt } from "./requestUserPrompt.js";

describe("requestUserPrompt", () => {
  let doc: Document;
  let shadowRoot: ShadowRoot;
  let dialog: HTMLDialogElement;
  let messageEl: HTMLElement;
  let inputAreaEl: HTMLElement;

  beforeEach(() => {
    doc = document;
    shadowRoot = doc.createElement("div").attachShadow({ mode: "open" });

    dialog = doc.createElement("dialog");
    dialog.className = "app-prompt-dialog";
    dialog.showModal = jest.fn();
    dialog.close = jest.fn();

    messageEl = doc.createElement("div");
    messageEl.className = "app-prompt-dialog__message";

    inputAreaEl = doc.createElement("div");
    inputAreaEl.className = "app-prompt-dialog__input-area";

    dialog.append(messageEl, inputAreaEl);
    shadowRoot.append(dialog);
  });

  it("should return null if shadowRoot is not provided", async () => {
    const result = await requestUserPrompt(doc, null, { question: "Q" });
    expect(result).toBeNull();
  });

  it("should return null if required elements are missing", async () => {
    shadowRoot.innerHTML = "";
    const result = await requestUserPrompt(doc, shadowRoot, { question: "Q" });
    expect(result).toBeNull();
  });

  it("should populate text input and return value on submit", async () => {
    const p = requestUserPrompt(doc, shadowRoot, {
      question: "What is your name?",
    });

    expect(messageEl.textContent).toBe("What is your name?");
    expect(inputAreaEl.children.length).toBe(1);
    const input = inputAreaEl.querySelector("input");
    expect(input).not.toBeNull();
    expect(input?.type).toBe("text");

    expect(dialog.showModal).toHaveBeenCalled();

    if (input) {
      input.value = "Alice";
    }

    dialog.returnValue = "submit";
    dialog.dispatchEvent(new Event("close"));

    const result = await p;
    expect(result).toBe("Alice");
  });

  it("should populate select element if options are provided", async () => {
    const p = requestUserPrompt(doc, shadowRoot, {
      question: "Pick one",
      options: ["A", "B"],
    });

    expect(messageEl.textContent).toBe("Pick one");
    const select = inputAreaEl.querySelector("select");
    expect(select).not.toBeNull();
    expect(select?.children.length).toBe(2);
    expect(select?.children[0].textContent).toBe("A");

    if (select) {
      select.value = "B";
    }

    dialog.returnValue = "submit";
    dialog.dispatchEvent(new Event("close"));

    const result = await p;
    expect(result).toBe("B");
  });

  it("should return null if dialog is closed without submitting", async () => {
    const p = requestUserPrompt(doc, shadowRoot, { question: "Q" });

    dialog.returnValue = "cancel";
    dialog.dispatchEvent(new Event("close"));

    const result = await p;
    expect(result).toBeNull();
  });

  it("should return null if submit but input element is missing", async () => {
    const p = requestUserPrompt(doc, shadowRoot, { question: "Q" });

    inputAreaEl.innerHTML = ""; // removing input element
    dialog.returnValue = "submit";
    dialog.dispatchEvent(new Event("close"));

    const result = await p;
    expect(result).toBeNull();
  });

  it("should close the dialog if already open", () => {
    Object.defineProperty(dialog, "open", { value: true, configurable: true });
    requestUserPrompt(doc, shadowRoot, { question: "Q" });
    expect(dialog.close).toHaveBeenCalled();
  });
});
