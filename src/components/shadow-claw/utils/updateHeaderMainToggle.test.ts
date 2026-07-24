import { jest } from "@jest/globals";

describe("updateHeaderMainToggle", () => {
  let shadowRoot: ShadowRoot;
  let button: HTMLButtonElement;
  let updateHeaderMainToggle: any;
  let mockGetActivePageHeaderElement: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    button = document.createElement("button");
    button.className = "header-main-toggle";
    shadowRoot.appendChild(button);

    mockGetActivePageHeaderElement = jest.fn();

    jest.unstable_mockModule("./getActivePageHeaderElement.js", () => ({
      getActivePageHeaderElement: mockGetActivePageHeaderElement,
    }));

    const module = await import("./updateHeaderMainToggle.js");
    updateHeaderMainToggle = module.updateHeaderMainToggle;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should return early if shadowRoot is null", () => {
    updateHeaderMainToggle(null, true);
    expect(mockGetActivePageHeaderElement).not.toHaveBeenCalled();
  });

  it("should return early if button is not found", () => {
    shadowRoot.innerHTML = "";
    updateHeaderMainToggle(shadowRoot, true);
    expect(mockGetActivePageHeaderElement).not.toHaveBeenCalled();
  });

  it("should use override value if provided as boolean", () => {
    updateHeaderMainToggle(shadowRoot, true);

    expect(button.getAttribute("aria-label")).toBe("Show action header");
    expect(button.getAttribute("title")).toBe("Show action header");
    expect(button.getAttribute("aria-pressed")).toBe("true");

    updateHeaderMainToggle(shadowRoot, false);

    expect(button.getAttribute("aria-label")).toBe("Hide action header");
    expect(button.getAttribute("title")).toBe("Hide action header");
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("should fallback to header element state if override is missing or null", () => {
    mockGetActivePageHeaderElement.mockReturnValue({
      isMainCollapsed: () => true,
    });
    updateHeaderMainToggle(shadowRoot, null);

    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("should fallback to false if header element or method is missing", () => {
    mockGetActivePageHeaderElement.mockReturnValue({});
    updateHeaderMainToggle(shadowRoot);

    expect(button.getAttribute("aria-pressed")).toBe("false");
  });
});
