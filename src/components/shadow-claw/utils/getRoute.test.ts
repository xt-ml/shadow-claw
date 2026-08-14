import { jest } from "@jest/globals";

describe("getRoute", () => {
  let db: any;

  let isPossibleAppRouteMock: jest.Mock;
  let getRoute: any;

  beforeEach(async () => {
    db = {};

    isPossibleAppRouteMock = jest.fn().mockReturnValue(true);

    jest.resetModules();
    jest.unstable_mockModule("../../../core/app-routes.js", () => ({
      isPossibleAppRoute: isPossibleAppRouteMock,
    }));

    // Re-import after mocking
    const { getRoute: getRouteReloaded } = await import("./getRoute.js");
    getRoute = getRouteReloaded;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns undefined if db is falsy", () => {
    const result = getRoute(null as any, new Event("navigate"));
    expect(result).toBeUndefined();
    expect(isPossibleAppRouteMock).not.toHaveBeenCalled();
  });

  it("returns undefined if navigationType is 'reload'", () => {
    const navigateEvent = new Event("navigate") as any;
    navigateEvent.navigationType = "reload";
    navigateEvent.destination = { url: "https://example.com/test" };
    const result = getRoute(db, navigateEvent);
    expect(result).toBeUndefined();
    expect(isPossibleAppRouteMock).not.toHaveBeenCalled();
  });

  it("returns undefined if destinationUrl is not a string", () => {
    const navigateEvent = new Event("navigate") as any;
    navigateEvent.navigationType = "push";
    navigateEvent.destination = { url: 123 };
    const result = getRoute(db, navigateEvent);
    expect(result).toBeUndefined();
    expect(isPossibleAppRouteMock).not.toHaveBeenCalled();
  });

  it("returns undefined if destination URL origin does not match window.location.origin", () => {
    const navigateEvent = new Event("navigate") as any;
    navigateEvent.navigationType = "push";
    // Ensure this origin is different from the real window.location.origin
    const differentOrigin =
      window.location.origin === "http://localhost"
        ? "https://different-origin.com"
        : "http://localhost";
    navigateEvent.destination = { url: `${differentOrigin}/test` };

    const result = getRoute(db, navigateEvent);
    expect(result).toBeUndefined();
    expect(isPossibleAppRouteMock).not.toHaveBeenCalled();
  });

  it("returns parsedUrl and navigateEvent when all conditions pass", () => {
    isPossibleAppRouteMock.mockReturnValue(true);

    const navigateEvent = new Event("navigate") as any;
    navigateEvent.navigationType = "push";
    navigateEvent.destination = { url: `${window.location.origin}/test` };

    const result = getRoute(db, navigateEvent);

    expect(isPossibleAppRouteMock).toHaveBeenCalledTimes(1);
    expect(isPossibleAppRouteMock).toHaveBeenCalledWith("/test");
    expect(result).toEqual({
      parsedUrl: expect.any(URL),
      navigateEvent,
    });
    expect(result.parsedUrl.pathname).toBe("/test");
  });

  it("returns undefined if isPossibleAppRoute returns false", () => {
    isPossibleAppRouteMock.mockReturnValue(false);

    const navigateEvent = new Event("navigate") as any;
    navigateEvent.navigationType = "push";
    navigateEvent.destination = { url: `${window.location.origin}/test` };

    const result = getRoute(db, navigateEvent);

    expect(result).toBeUndefined();
  });
});
