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

    const countdownEl = doc.createElement("p");
    countdownEl.className = "app-dialog__countdown";
    countdownEl.setAttribute("role", "status");
    countdownEl.setAttribute("aria-live", "polite");
    countdownEl.setAttribute("aria-atomic", "true");
    countdownEl.hidden = true;

    confirmBtn = doc.createElement("button");
    confirmBtn.className = "app-dialog__btn--confirm";

    cancelBtn = doc.createElement("button");
    cancelBtn.className = "app-dialog__btn--cancel";

    dialog.append(
      titleEl,
      messageEl,
      detailsEl,
      linksEl,
      countdownEl,
      confirmBtn,
      cancelBtn,
    );
    shadowRoot.append(dialog);
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it("should show countdown and auto-close after autoCloseSeconds expires", async () => {
    jest.useFakeTimers();

    const countdownEl = shadowRoot.querySelector(
      ".app-dialog__countdown",
    ) as HTMLElement;

    const p = requestDialog(doc, shadowRoot, {
      title: "Rate Limited",
      message: "OpenRouter is throttling requests",
      mode: "info",
      confirmLabel: "OK",
      autoCloseSeconds: 30,
    });

    expect(countdownEl.hidden).toBe(false);
    expect(countdownEl.textContent).toContain("30");
    expect(confirmBtn.textContent).toBe("OK (30s)");
    expect(countdownEl.getAttribute("role")).toBe("status");
    expect(countdownEl.getAttribute("aria-live")).toBe("polite");

    // Advance 1 second
    jest.advanceTimersByTime(1000);
    expect(countdownEl.textContent).toContain("29");
    expect(confirmBtn.textContent).toBe("OK (29s)");

    // Advance 28 more seconds (total 29s elapsed, 1s remaining)
    jest.advanceTimersByTime(28000);
    expect(countdownEl.textContent).toContain("1");
    expect(confirmBtn.textContent).toBe("OK (1s)");

    // Advance last 1 second -> should auto close dialog
    (dialog.close as jest.Mock<any>).mockImplementation(() => {
      dialog.dispatchEvent(new Event("close"));
    });

    jest.advanceTimersByTime(1000);
    expect(dialog.close).toHaveBeenCalled();

    const result = await p;
    expect(result).toBe(true);
  });

  it("should clear timer if user closes early", async () => {
    jest.useFakeTimers();

    const p = requestDialog(doc, shadowRoot, {
      title: "Rate Limited",
      message: "OpenRouter is throttling requests",
      mode: "info",
      autoCloseSeconds: 30,
    });

    // Advance 5 seconds
    jest.advanceTimersByTime(5000);

    // Simulate user closing
    dialog.returnValue = "confirm";
    dialog.dispatchEvent(new Event("close"));

    const result = await p;
    expect(result).toBe(true);

    // Advancing past 30s should not trigger another close
    dialog.close = jest.fn();
    jest.advanceTimersByTime(30000);
    expect(dialog.close).not.toHaveBeenCalled();
  });

  it("should keep countdown element hidden when autoCloseSeconds is not provided", async () => {
    const countdownEl = shadowRoot.querySelector(
      ".app-dialog__countdown",
    ) as HTMLElement;

    const p = requestDialog(doc, shadowRoot, {
      title: "Normal Dialog",
      message: "No auto close",
    });

    expect(countdownEl.hidden).toBe(true);
    expect(confirmBtn.textContent).toBe("Confirm");

    dialog.returnValue = "confirm";
    dialog.dispatchEvent(new Event("close"));
    await p;
  });
});
