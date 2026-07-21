import { jest } from "@jest/globals";

describe("fallbackClickListener", () => {
  let fallbackClickListener: any;
  let shadowRootMock: ShadowRoot | null;
  let shadowClawMock: any;
  let dbMock: any;
  let fStoreMock: any;
  let oStoreMock: any;
  let urlMock: URL;
  let historyStateMock: jest.Mock<any>;
  let applyRouteFromCurrentLocationMock: jest.Mock<any>;

  beforeEach(async () => {
    jest.resetModules();

    jest.unstable_mockModule("./historyState.js", () => ({
      historyState: jest.fn(),
    }));
    jest.unstable_mockModule("./applyRouteFromCurrentLocation.js", () => ({
      applyRouteFromCurrentLocation: jest.fn(),
    }));

    historyStateMock = (await import("./historyState.js"))
      .historyState as jest.Mock<any>;
    applyRouteFromCurrentLocationMock = (
      await import("./applyRouteFromCurrentLocation.js")
    ).applyRouteFromCurrentLocation as jest.Mock<any>;
    fallbackClickListener = (await import("./fallbackClickListener.js"))
      .fallbackClickListener;

    shadowRootMock = {
      querySelector: jest.fn(),
    } as unknown as ShadowRoot;

    shadowClawMock = {};
    dbMock = {};
    fStoreMock = {};
    oStoreMock = {};
    urlMock = new URL("http://localhost");

    // Mock globalThis.history
    (globalThis as any).history = {
      pushState: jest.fn(),
      replaceState: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should do nothing if event.defaultPrevented is true", () => {
    const listener = fallbackClickListener(
      shadowRootMock,
      shadowClawMock,
      dbMock,
      fStoreMock,
      oStoreMock,
      urlMock,
    );
    const anchor = document.createElement("a");
    anchor.href = "/new-page";
    const event = new MouseEvent("click", { button: 0, cancelable: true });
    event.preventDefault();
    Object.defineProperty(event, "composedPath", {
      value: () => [anchor],
    });
    listener(event);
    expect(historyStateMock).not.toHaveBeenCalled();
    expect(applyRouteFromCurrentLocationMock).not.toHaveBeenCalled();
  });

  it("should do nothing for non-left clicks", () => {
    const listener = fallbackClickListener(
      shadowRootMock,
      shadowClawMock,
      dbMock,
      fStoreMock,
      oStoreMock,
      urlMock,
    );
    const event = new MouseEvent("click", { button: 1 }); // middle button
    listener(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("should do nothing for metaKey", () => {
    const listener = fallbackClickListener(
      shadowRootMock,
      shadowClawMock,
      dbMock,
      fStoreMock,
      oStoreMock,
      urlMock,
    );
    const event = new MouseEvent("click", { button: 0, metaKey: true });
    listener(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("should do nothing for ctrlKey", () => {
    const listener = fallbackClickListener(
      shadowRootMock,
      shadowClawMock,
      dbMock,
      fStoreMock,
      oStoreMock,
      urlMock,
    );
    const event = new MouseEvent("click", { button: 0, ctrlKey: true });
    listener(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("should do nothing for shiftKey", () => {
    const listener = fallbackClickListener(
      shadowRootMock,
      shadowClawMock,
      dbMock,
      fStoreMock,
      oStoreMock,
      urlMock,
    );
    const event = new MouseEvent("click", { button: 0, shiftKey: true });
    listener(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("should do nothing for altKey", () => {
    const listener = fallbackClickListener(
      shadowRootMock,
      shadowClawMock,
      dbMock,
      fStoreMock,
      oStoreMock,
      urlMock,
    );
    const event = new MouseEvent("click", { button: 0, altKey: true });
    listener(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("should do nothing if no anchor in path", () => {
    const listener = fallbackClickListener(
      shadowRootMock,
      shadowClawMock,
      dbMock,
      fStoreMock,
      oStoreMock,
      urlMock,
    );
    const event = new MouseEvent("click", { button: 0 });
    Object.defineProperty(event, "composedPath", {
      value: () => [document.createElement("div")],
    });
    listener(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("should do nothing if anchor href is empty", () => {
    const listener = fallbackClickListener(
      shadowRootMock,
      shadowClawMock,
      dbMock,
      fStoreMock,
      oStoreMock,
      urlMock,
    );
    const anchor = document.createElement("a");
    anchor.href = "";
    const event = new MouseEvent("click", { button: 0 });
    Object.defineProperty(event, "composedPath", {
      value: () => [anchor],
    });
    listener(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("should do nothing if anchor href starts with javascript:", () => {
    const listener = fallbackClickListener(
      shadowRootMock,
      shadowClawMock,
      dbMock,
      fStoreMock,
      oStoreMock,
      urlMock,
    );
    const anchor = document.createElement("a");
    anchor.href = "javascript:void(0)";
    const event = new MouseEvent("click", { button: 0 });
    Object.defineProperty(event, "composedPath", {
      value: () => [anchor],
    });
    listener(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("should do nothing if anchor href starts with mailto:", () => {
    const listener = fallbackClickListener(
      shadowRootMock,
      shadowClawMock,
      dbMock,
      fStoreMock,
      oStoreMock,
      urlMock,
    );
    const anchor = document.createElement("a");
    anchor.href = "mailto:test@example.com";
    const event = new MouseEvent("click", { button: 0 });
    Object.defineProperty(event, "composedPath", {
      value: () => [anchor],
    });
    listener(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("should do nothing if anchor href starts with tel:", () => {
    const listener = fallbackClickListener(
      shadowRootMock,
      shadowClawMock,
      dbMock,
      fStoreMock,
      oStoreMock,
      urlMock,
    );
    const anchor = document.createElement("a");
    anchor.href = "tel:1234567890";
    const event = new MouseEvent("click", { button: 0 });
    Object.defineProperty(event, "composedPath", {
      value: () => [anchor],
    });
    listener(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("should do nothing if anchor target is not _self", () => {
    const listener = fallbackClickListener(
      shadowRootMock,
      shadowClawMock,
      dbMock,
      fStoreMock,
      oStoreMock,
      urlMock,
    );
    const anchor = document.createElement("a");
    anchor.href = "/some/path";
    anchor.target = "_blank";
    const event = new MouseEvent("click", { button: 0 });
    Object.defineProperty(event, "composedPath", {
      value: () => [anchor],
    });
    listener(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("should do nothing if anchor origin is different", () => {
    const listener = fallbackClickListener(
      shadowRootMock,
      shadowClawMock,
      dbMock,
      fStoreMock,
      oStoreMock,
      urlMock,
    );
    const anchor = document.createElement("a");
    anchor.href = "https://example.com/some/path";
    const event = new MouseEvent("click", { button: 0 });
    Object.defineProperty(event, "composedPath", {
      value: () => [anchor],
    });
    listener(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("should do nothing if anchor points to current path and search but different hash", () => {
    const listener = fallbackClickListener(
      shadowRootMock,
      shadowClawMock,
      dbMock,
      fStoreMock,
      oStoreMock,
      urlMock,
    );
    const anchor = document.createElement("a");
    anchor.href =
      window.location.pathname + window.location.search + "#section";
    const event = new MouseEvent("click", { button: 0, cancelable: true });
    Object.defineProperty(event, "composedPath", {
      value: () => [anchor],
    });
    listener(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("should prevent default and call historyState and applyRouteFromCurrentLocation on valid click", () => {
    const listener = fallbackClickListener(
      shadowRootMock,
      shadowClawMock,
      dbMock,
      fStoreMock,
      oStoreMock,
      urlMock,
    );
    const anchor = document.createElement("a");
    anchor.href = window.location.origin + "/new-page";
    anchor.setAttribute("href", "/new-page");
    const event = new MouseEvent("click", { button: 0, cancelable: true });
    Object.defineProperty(event, "composedPath", {
      value: () => [anchor],
    });
    listener(event);
    expect(event.defaultPrevented).toBe(true);
    expect(historyStateMock).toHaveBeenCalledWith(
      (globalThis as any).history,
      "/new-page",
      { replace: false, useTrailingSlash: false },
    );
    expect(applyRouteFromCurrentLocationMock).toHaveBeenCalledWith(
      shadowRootMock,
      shadowClawMock,
      dbMock,
      fStoreMock,
      oStoreMock,
      urlMock,
    );
  });
});
