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

    jest.unstable_mockModule("./clamp-sidebar-width.js", () => ({
      clampSidebarWidth: mockClampSidebarWidth,
    }));

    const module = await import("./set-sidebar-width.js");
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

  it("should snap to 0px, mark collapsed/aria-hidden/inert, and set data-sidebar-mode when px is below 175", () => {
    const sidebar = document.createElement("aside");
    sidebar.className = "sidebar";
    appBody.appendChild(sidebar);
    mockClampSidebarWidth.mockReturnValue(175);

    setSidebarWidth(shadowRoot, 160);

    expect(mockClampSidebarWidth).not.toHaveBeenCalled();
    expect(appBody.style.getPropertyValue("--sidebar-width")).toBe("0px");
    expect(appBody.classList.contains("sidebar-collapsed")).toBe(true);
    expect(sidebar.classList.contains("collapsed")).toBe(true);
    expect(sidebar.dataset.sidebarMode).toBe("collapsed");
    expect(sidebar.getAttribute("aria-hidden")).toBe("true");
    expect(sidebar.hasAttribute("inert")).toBe(true);

    setSidebarWidth(shadowRoot, 0);
    expect(appBody.style.getPropertyValue("--sidebar-width")).toBe("0px");
    expect(sidebar.dataset.sidebarMode).toBe("collapsed");
  });

  it("should clear collapsed, aria-hidden, and inert and set data-sidebar-mode to expanded when px >= 175", () => {
    const sidebar = document.createElement("aside");
    sidebar.className = "sidebar collapsed";
    sidebar.dataset.sidebarMode = "collapsed";
    sidebar.setAttribute("aria-hidden", "true");
    sidebar.setAttribute("inert", "");
    appBody.classList.add("sidebar-collapsed");
    appBody.appendChild(sidebar);
    mockClampSidebarWidth.mockReturnValue(175);

    setSidebarWidth(shadowRoot, 175);

    expect(mockClampSidebarWidth).toHaveBeenCalledWith(shadowRoot, 175);
    expect(appBody.style.getPropertyValue("--sidebar-width")).toBe("175px");
    expect(appBody.classList.contains("sidebar-collapsed")).toBe(false);
    expect(sidebar.classList.contains("collapsed")).toBe(false);
    expect(sidebar.dataset.sidebarMode).toBe("expanded");
    expect(sidebar.hasAttribute("aria-hidden")).toBe(false);
    expect(sidebar.hasAttribute("inert")).toBe(false);
  });

  it("should not mark sidebar aria-hidden or inert when mobile drawer is open even if width is 0", () => {
    const sidebar = document.createElement("aside");
    sidebar.className = "sidebar open";
    appBody.appendChild(sidebar);

    setSidebarWidth(shadowRoot, 0);

    expect(sidebar.classList.contains("collapsed")).toBe(true);
    expect(sidebar.dataset.sidebarMode).toBe("collapsed");
    expect(sidebar.hasAttribute("aria-hidden")).toBe(false);
    expect(sidebar.hasAttribute("inert")).toBe(false);
  });
});
