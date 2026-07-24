import { jest } from "@jest/globals";
import { renderTabs } from "./tabs.js";
import type { TabsSpec } from "../../../ui/a2ui.js";

describe("renderTabs", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders a basic tabs container and headers", () => {
    const spec: TabsSpec = {
      id: "test-tabs",
      component: "Tabs",
      tabs: [
        { title: "Tab 1", child: "child-1" },
        { title: "Tab 2", child: "child-2" },
      ],
    };

    const mockChild1 = document.createElement("div");
    mockChild1.id = "mock-1";
    const mockChild2 = document.createElement("div");
    mockChild2.id = "mock-2";

    const ctx = {
      renderComponent: jest.fn().mockImplementation((id: any) => {
        if (id === "child-1") return mockChild1;
        if (id === "child-2") return mockChild2;
        return null;
      }),
    } as any;

    const el = renderTabs(spec, { dataModel: {} } as any, ctx);

    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("a2ui__tabs");

    const headers = el.querySelectorAll(".a2ui__tab-header");
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toBe("Tab 1");
    expect(headers[1].textContent).toBe("Tab 2");

    // First tab is active by default
    expect(headers[0].classList.contains("active")).toBe(true);
    expect(headers[1].classList.contains("active")).toBe(false);

    const content = el.querySelector(".a2ui__tabs-content");
    expect(content?.contains(mockChild1)).toBe(true);
    expect(content?.contains(mockChild2)).toBe(false);
  });

  it("switches tabs on click", () => {
    const spec: TabsSpec = {
      id: "test-tabs",
      component: "Tabs",
      tabs: [
        { title: "Tab 1", child: "child-1" },
        { title: "Tab 2", child: "child-2" },
      ],
    };

    const ctx = {
      renderComponent: jest.fn().mockReturnValue(document.createElement("div")),
    } as any;

    const el = renderTabs(spec, { dataModel: {} } as any, ctx);
    const headers = el.querySelectorAll<HTMLButtonElement>(".a2ui__tab-header");

    headers[1].click();

    expect(headers[0].classList.contains("active")).toBe(false);
    expect(headers[1].classList.contains("active")).toBe(true);
    expect(ctx.renderComponent).toHaveBeenCalledWith("child-2");
  });

  it("warns if tabs array is missing or invalid", () => {
    const spec: TabsSpec = {
      id: "test-tabs-invalid",
      component: "Tabs",
      tabs: null as any,
    };

    const ctx = {
      renderComponent: jest.fn(),
    } as any;

    const el = renderTabs(spec, { dataModel: {} } as any, ctx);
    expect(console.warn).toHaveBeenCalledWith(
      `[shadow-claw-a2ui] Tab spec is missing or invalid for component id: "test-tabs-invalid"`,
    );
    expect(el.querySelector(".a2ui__tabs-headers")?.children.length).toBe(0);
  });
});
