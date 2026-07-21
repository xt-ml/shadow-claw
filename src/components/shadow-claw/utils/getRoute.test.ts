import { jest } from "@jest/globals";

describe("getRoute", () => {
  let db: any;
  let oStore: any;
  let parseRouteFromUrlMock: jest.Mock;
  let getRoute: any;

  beforeEach(async () => {
    db = {};
    oStore = { activeGroupId: "test-group-id" };
    parseRouteFromUrlMock = jest.fn();

    jest.resetModules();
    jest.unstable_mockModule("../../../core/app-routes.js", () => ({
      parseRouteFromUrl: parseRouteFromUrlMock,
    }));

    // Re-import after mocking
    const { getRoute: getRouteReloaded } = await import("./getRoute.js");
    getRoute = getRouteReloaded;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns undefined if db is falsy", () => {
    const result = getRoute(null as any, oStore, new Event("navigate"));
    expect(result).toBeUndefined();
    expect(parseRouteFromUrlMock).not.toHaveBeenCalled();
  });

  it("returns undefined if navigationType is 'reload'", () => {
    const navigateEvent = new Event("navigate") as any;
    navigateEvent.navigationType = "reload";
    navigateEvent.destination = { url: "https://example.com/test" };
    const result = getRoute(db, oStore, navigateEvent);
    expect(result).toBeUndefined();
    expect(parseRouteFromUrlMock).not.toHaveBeenCalled();
  });

  it("returns undefined if destinationUrl is not a string", () => {
    const navigateEvent = new Event("navigate") as any;
    navigateEvent.navigationType = "push";
    navigateEvent.destination = { url: 123 };
    const result = getRoute(db, oStore, navigateEvent);
    expect(result).toBeUndefined();
    expect(parseRouteFromUrlMock).not.toHaveBeenCalled();
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

    const result = getRoute(db, oStore, navigateEvent);
    expect(result).toBeUndefined();
    expect(parseRouteFromUrlMock).not.toHaveBeenCalled();
  });

  it("returns route and navigateEvent when all conditions pass", () => {
    const mockRoute = { pathname: "/test", params: {} };
    parseRouteFromUrlMock.mockReturnValue(mockRoute);

    const navigateEvent = new Event("navigate") as any;
    navigateEvent.navigationType = "push";
    navigateEvent.destination = { url: `${window.location.origin}/test` };

    const result = getRoute(db, oStore, navigateEvent);

    expect(parseRouteFromUrlMock).toHaveBeenCalledTimes(1);
    expect(parseRouteFromUrlMock).toHaveBeenCalledWith(
      expect.any(URL),
      oStore.activeGroupId,
    );
    expect(result).toEqual({
      route: mockRoute,
      navigateEvent,
    });
  });
});
