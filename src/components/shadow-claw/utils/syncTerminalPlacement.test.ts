import { jest } from "@jest/globals";

describe("syncTerminalPlacement", () => {
  let shadowRoot: ShadowRoot;
  let terminalElement: any;
  let syncTerminalPlacement: any;
  let mockGetTerminalSlotForPage: any;
  let slot: HTMLElement;

  beforeEach(async () => {
    jest.clearAllMocks();

    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    terminalElement = document.createElement("shadow-claw-terminal");
    shadowRoot.appendChild(terminalElement);

    slot = document.createElement("div");
    shadowRoot.appendChild(slot);

    mockGetTerminalSlotForPage = jest.fn().mockReturnValue(slot);

    jest.unstable_mockModule("./getTerminalSlotForPage.js", () => ({
      getTerminalSlotForPage: mockGetTerminalSlotForPage,
    }));

    const module = await import("./syncTerminalPlacement.js");
    syncTerminalPlacement = module.syncTerminalPlacement;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should return early if terminal element is missing", () => {
    syncTerminalPlacement(shadowRoot, "chat", null, true);
    expect(mockGetTerminalSlotForPage).not.toHaveBeenCalled();
  });

  it("should return early if slot is not found", () => {
    mockGetTerminalSlotForPage.mockReturnValue(null);
    syncTerminalPlacement(shadowRoot, "chat", terminalElement, true);
    expect(terminalElement.parentNode).toBe(shadowRoot); // Did not move
  });

  it("should append terminal to slot if not already there, and show it", () => {
    syncTerminalPlacement(shadowRoot, "chat", terminalElement, true);

    expect(terminalElement.parentNode).toBe(slot);
    expect(terminalElement.hidden).toBe(false);
    expect(slot.hasAttribute("hidden")).toBe(false);
    expect(terminalElement.hasAttribute("hidden")).toBe(false);
  });

  it("should hide terminal and slot if terminalVisible is false", () => {
    syncTerminalPlacement(shadowRoot, "chat", terminalElement, false);

    expect(terminalElement.hidden).toBe(true);
    expect(slot.getAttribute("hidden")).toBe("hidden");
    expect(terminalElement.getAttribute("hidden")).toBe("hidden");
  });

  it("should not append if terminal is already in slot", () => {
    slot.appendChild(terminalElement);
    const appendChildSpy = jest.spyOn(slot, "appendChild");

    syncTerminalPlacement(shadowRoot, "chat", terminalElement, true);

    expect(appendChildSpy).not.toHaveBeenCalled();
  });
});
