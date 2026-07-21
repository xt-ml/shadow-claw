import { jest } from "@jest/globals";

import { getActivePageHeaderElement } from "./getActivePageHeaderElement";

describe("getActivePageHeaderElement", () => {
  let shadowRoot: ShadowRoot;
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement("div");
    shadowRoot = host.attachShadow({ mode: "open" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns null if shadowRoot is null", () => {
    expect(getActivePageHeaderElement(null)).toBeNull();
  });

  it("returns null if there is no .page.active element", () => {
    const page = document.createElement("div");
    page.className = "page"; // not active
    shadowRoot.appendChild(page);

    expect(getActivePageHeaderElement(shadowRoot)).toBeNull();
  });

  it("returns null if .page.active is not an HTMLElement", () => {
    const page = document.createTextNode("text") as any;
    page.className = "page active";
    shadowRoot.appendChild(page);

    expect(getActivePageHeaderElement(shadowRoot)).toBeNull();
  });

  it("returns null if pageContainer is not found", () => {
    const page = document.createElement("div");
    page.className = "page active";
    shadowRoot.appendChild(page);

    expect(getActivePageHeaderElement(shadowRoot)).toBeNull();
  });

  it("returns null if pageContainer is not an HTMLElement", () => {
    const page = document.createElement("div");
    page.className = "page active";
    shadowRoot.appendChild(page);

    const container = document.createTextNode("text");
    page.appendChild(container);

    expect(getActivePageHeaderElement(shadowRoot)).toBeNull();
  });

  it("returns null if pageContainer.shadowRoot is null", () => {
    const page = document.createElement("div");
    page.className = "page active";
    shadowRoot.appendChild(page);

    const container = document.createElement("div");
    page.appendChild(container);

    expect(getActivePageHeaderElement(shadowRoot)).toBeNull();
  });

  it("returns null if header is not found in shadowRoot", () => {
    const page = document.createElement("div");
    page.className = "page active";
    shadowRoot.appendChild(page);

    const container = document.createElement("div");
    container.attachShadow({ mode: "open" });
    page.appendChild(container);

    expect(getActivePageHeaderElement(shadowRoot)).toBeNull();
  });

  it("returns the header element when found and is an HTMLElement", () => {
    const page = document.createElement("div");
    page.className = "page active";
    shadowRoot.appendChild(page);

    const container = document.createElement("shadow-claw-chat");
    const shadow = container.attachShadow({ mode: "open" });
    page.appendChild(container);

    const header = document.createElement("shadow-claw-page-header");
    header.classList.add("page-header");
    shadow.appendChild(header);

    const result = getActivePageHeaderElement(shadowRoot);
    expect(result).toBe(header);
    expect(result).toBeInstanceOf(HTMLElement);
  });
});
