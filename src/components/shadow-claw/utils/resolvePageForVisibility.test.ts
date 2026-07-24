import { jest } from "@jest/globals";

describe("resolvePageForVisibility", () => {
  let mockGetDefaultSidebarPage: any;
  let resolvePageForVisibility: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetDefaultSidebarPage = jest.fn();

    jest.unstable_mockModule("./getDefaultSidebarPage.js", () => ({
      getDefaultSidebarPage: mockGetDefaultSidebarPage,
    }));

    const module = await import("./resolvePageForVisibility.js");
    resolvePageForVisibility = module.resolvePageForVisibility;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should return the given page if it is not 'pages'", () => {
    expect(resolvePageForVisibility({}, "chat", true)).toBe("chat");
    expect(resolvePageForVisibility({}, "files", false)).toBe("files");
    expect(mockGetDefaultSidebarPage).not.toHaveBeenCalled();
  });

  it("should return the given page if it is 'pages' but sidebar is not hidden", () => {
    expect(resolvePageForVisibility({}, "pages", false)).toBe("pages");
    expect(mockGetDefaultSidebarPage).not.toHaveBeenCalled();
  });

  it("should return default sidebar page if page is 'pages' and sidebar is hidden", () => {
    mockGetDefaultSidebarPage.mockReturnValue("chat");
    const result = resolvePageForVisibility({}, "pages", true);
    expect(result).toBe("chat");
    expect(mockGetDefaultSidebarPage).toHaveBeenCalledWith({});
  });
});
