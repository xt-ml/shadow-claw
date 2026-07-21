import { jest } from "@jest/globals";

import { getTerminalSlotForPage } from "./getTerminalSlotForPage";

describe("getTerminalSlotForPage", () => {
  let shadow: {
    querySelector: jest.Mock;
  };
  let pageEl: {
    querySelector: jest.Mock;
    instanceOfHTMLElement: boolean;
  };
  let childEl: {
    shadowRoot: {
      querySelector: jest.Mock;
    } | null;
    instanceOfHTMLElement: boolean;
  };
  let slotEl: HTMLElement | null;

  beforeEach(() => {
    slotEl = document.createElement("div");
    slotEl.setAttribute("data-terminal-slot", "true");

    childEl = {
      shadowRoot: {
        querySelector: jest.fn().mockReturnValue(slotEl),
      },
      instanceOfHTMLElement: true,
    };

    pageEl = {
      querySelector: jest.fn().mockReturnValue(childEl),
      instanceOfHTMLElement: true,
    };

    shadow = {
      querySelector: jest.fn().mockReturnValue(pageEl),
    };

    // Mock instanceof checks
    Object.setPrototypeOf(pageEl, HTMLElement.prototype);
    Object.setPrototypeOf(childEl, HTMLElement.prototype);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return null when shadow is null", () => {
    const result = getTerminalSlotForPage(null as any, "chat");
    expect(result).toBeNull();
  });

  it("should return null when shadow is undefined", () => {
    const result = getTerminalSlotForPage(undefined as any, "chat");
    expect(result).toBeNull();
  });

  it("should return null when page is not chat, tasks, or files", () => {
    const result = getTerminalSlotForPage(shadow as any, "invalid" as any);
    expect(result).toBeNull();
  });

  it("should return null when page element does not exist", () => {
    shadow.querySelector.mockReturnValue(null);
    const result = getTerminalSlotForPage(shadow as any, "chat");
    expect(result).toBeNull();
  });

  it("should return null when page element is not an HTMLElement", () => {
    const nonElement = {};
    shadow.querySelector.mockReturnValue(nonElement);
    const result = getTerminalSlotForPage(shadow as any, "chat");
    expect(result).toBeNull();
  });

  it("should return null when child component does not exist", () => {
    pageEl.querySelector.mockReturnValue(null);
    const result = getTerminalSlotForPage(shadow as any, "chat");
    expect(result).toBeNull();
  });

  it("should return null when child component is not an HTMLElement", () => {
    const nonElement = {};
    pageEl.querySelector.mockReturnValue(nonElement);
    const result = getTerminalSlotForPage(shadow as any, "chat");
    expect(result).toBeNull();
  });

  it("should return null when child component has no shadowRoot", () => {
    childEl.shadowRoot = null;
    const result = getTerminalSlotForPage(shadow as any, "chat");
    expect(result).toBeNull();
  });

  it("should return null when shadowRoot exists but no data-terminal-slot element", () => {
    childEl.shadowRoot!.querySelector.mockReturnValue(null);
    const result = getTerminalSlotForPage(shadow as any, "chat");
    expect(result).toBeNull();
  });

  it("should return null when shadowRoot querySelector returns non-HTMLElement", () => {
    const nonElement = {};
    childEl.shadowRoot!.querySelector.mockReturnValue(nonElement);
    const result = getTerminalSlotForPage(shadow as any, "chat");
    expect(result).toBeNull();
  });

  it("should return the slot element when everything is correctly configured for chat", () => {
    const result = getTerminalSlotForPage(shadow as any, "chat");
    expect(result).toBe(slotEl);
    expect(shadow.querySelector).toHaveBeenCalledWith('[data-page-id="chat"]');
    expect(pageEl.querySelector).toHaveBeenCalledWith(
      "shadow-claw-chat, shadow-claw-tasks, shadow-claw-files",
    );
    expect(childEl.shadowRoot?.querySelector).toHaveBeenCalledWith(
      "[data-terminal-slot]",
    );
  });

  it("should return the slot element when everything is correctly configured for tasks", () => {
    const result = getTerminalSlotForPage(shadow as any, "tasks");
    expect(result).toBe(slotEl);
    expect(shadow.querySelector).toHaveBeenCalledWith('[data-page-id="tasks"]');
  });

  it("should return the slot element when everything is correctly configured for files", () => {
    const result = getTerminalSlotForPage(shadow as any, "files");
    expect(result).toBe(slotEl);
    expect(shadow.querySelector).toHaveBeenCalledWith('[data-page-id="files"]');
  });

  it("should query for the correct child component selectors for each page type", () => {
    getTerminalSlotForPage(shadow as any, "chat");
    expect(pageEl.querySelector).toHaveBeenCalledWith(
      "shadow-claw-chat, shadow-claw-tasks, shadow-claw-files",
    );

    getTerminalSlotForPage(shadow as any, "tasks");
    expect(pageEl.querySelector).toHaveBeenCalledWith(
      "shadow-claw-chat, shadow-claw-tasks, shadow-claw-files",
    );

    getTerminalSlotForPage(shadow as any, "files");
    expect(pageEl.querySelector).toHaveBeenCalledWith(
      "shadow-claw-chat, shadow-claw-tasks, shadow-claw-files",
    );
  });
});
