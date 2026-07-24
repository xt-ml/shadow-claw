import { jest } from "@jest/globals";

describe("setSidebarWidth", () => {
  let shadowRoot: ShadowRoot;
  let appBody: HTMLElement;
  let mockClampSidebarWidth: any;
  let setSidebarWidth: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    appBody = document.createElement("div");
    appBody.className = "app-body";
    shadowRoot.appendChild(appBody);

    mockClampSidebarWidth = jest.fn().mockReturnValue(250);

    jest.unstable_mockModule("./clampSidebarWidth.js", () => ({
      clampSidebarWidth: mockClampSidebarWidth,
    }));

    const module = await import("./setSidebarWidth.js");
    setSidebarWidth = module.setSidebarWidth;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should do nothing if appBody is not found", () => {
    shadowRoot.innerHTML = "";
    setSidebarWidth(shadowRoot, 300);
    expect(mockClampSidebarWidth).not.toHaveBeenCalled();
  });

  it("should do nothing if shadowRoot is null", () => {
    setSidebarWidth(null, 300);
    expect(mockClampSidebarWidth).not.toHaveBeenCalled();
  });

  it("should set --sidebar-width property on appBody", () => {
    setSidebarWidth(shadowRoot, 300);
    expect(mockClampSidebarWidth).toHaveBeenCalledWith(shadowRoot, 300);
    expect(appBody.style.getPropertyValue("--sidebar-width")).toBe("250px");
  });
});
