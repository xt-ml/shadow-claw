import { jest } from "@jest/globals";

import { PageHeaderLikeElement } from "../../types.js";
import { getPageHeaderElements } from "./getPageHeaderElements";

describe("getPageHeaderElements", () => {
  let shadowRoot: ShadowRoot;
  let container: HTMLElement;
  let header: HTMLElement & PageHeaderLikeElement;

  beforeEach(() => {
    // Create a mock shadow root
    shadowRoot = {
      querySelector: jest.fn(),
    } as unknown as ShadowRoot;

    // Create a mock container element
    container = document.createElement("shadow-claw-chat");
    container.attachShadow({ mode: "open" });

    // Create a mock header element that implements PageHeaderLikeElement
    header = document.createElement(
      "shadow-claw-page-header",
    ) as unknown as HTMLElement & PageHeaderLikeElement;
  });

  it("returns empty array when shadow root is null", () => {
    const result = getPageHeaderElements(null);
    expect(result).toEqual([]);
  });

  it("returns empty array when no containers match", () => {
    shadowRoot.querySelector = jest.fn().mockReturnValue(null);
    const result = getPageHeaderElements(shadowRoot);
    expect(result).toEqual([]);

    const expectedCalls = [
      "shadow-claw-chat",
      "shadow-claw-tasks",
      "shadow-claw-files",
      "shadow-claw-pages",
      "shadow-claw-settings",
      "shadow-claw-tools",
      "shadow-claw-channels",
    ];

    expect(shadowRoot.querySelector).toHaveBeenCalledTimes(
      expectedCalls.length,
    );
    expectedCalls.forEach((call) => {
      expect(shadowRoot.querySelector).toHaveBeenCalledWith(call);
    });
  });

  it("returns header when container has shadowRoot with header", () => {
    const headerShadowRoot = container.shadowRoot!;
    headerShadowRoot.querySelector = jest.fn().mockReturnValue(header);

    shadowRoot.querySelector = jest.fn().mockImplementation((selector) => {
      if (selector === "shadow-claw-chat") {
        return container;
      }

      return null;
    });

    const result = getPageHeaderElements(shadowRoot);
    expect(result).toEqual([header]);
    expect(shadowRoot.querySelector).toHaveBeenCalledWith("shadow-claw-chat");
    expect(headerShadowRoot.querySelector).toHaveBeenCalledWith(
      "shadow-claw-page-header",
    );
  });

  it("returns headers from multiple containers", () => {
    const container1 = document.createElement("shadow-claw-chat");
    const shadow1 = container1.attachShadow({ mode: "open" });
    shadow1.querySelector = jest.fn().mockReturnValue(header);

    const header2 = document.createElement(
      "shadow-claw-page-header",
    ) as unknown as HTMLElement & PageHeaderLikeElement;
    const container2 = document.createElement("shadow-claw-tasks");
    const shadow2 = container2.attachShadow({ mode: "open" });
    shadow2.querySelector = jest.fn().mockReturnValue(header2);

    shadowRoot.querySelector = jest
      .fn()
      .mockImplementationOnce((selector) => {
        if (selector === "shadow-claw-chat") {
          return container1;
        }

        return null;
      })
      .mockImplementationOnce((selector) => {
        if (selector === "shadow-claw-tasks") {
          return container2;
        }

        return null;
      });

    const result = getPageHeaderElements(shadowRoot);
    expect(result).toEqual([header, header2]);
    expect(shadowRoot.querySelector).toHaveBeenCalledTimes(7);
  });

  it("ignores containers that are not HTMLElement", () => {
    const nullContainer = null as unknown;
    shadowRoot.querySelector = jest.fn().mockReturnValue(nullContainer);
    const result = getPageHeaderElements(shadowRoot);
    expect(result).toEqual([]);
  });

  it("ignores containers whose shadowRoot query returns non-HTML element", () => {
    const container = {
      shadowRoot: {
        querySelector: jest.fn().mockReturnValue(null), // returns null instead of element
      } as unknown as ShadowRoot,
    } as HTMLElement;
    shadowRoot.querySelector = jest.fn().mockReturnValue(container);
    const result = getPageHeaderElements(shadowRoot);
    expect(result).toEqual([]);
  });
});
