import { supportsNavigationApi } from "./supportsNavigationApi.js";

describe("supportsNavigationApi", () => {
  let originalNavigation: any;

  beforeEach(() => {
    originalNavigation = (globalThis.window as any).navigation;
  });

  afterEach(() => {
    (globalThis.window as any).navigation = originalNavigation;
  });

  it("should return false if navigation is not present", () => {
    delete (globalThis.window as any).navigation;
    expect(supportsNavigationApi()).toBe(false);
  });

  it("should return false if addEventListener is missing", () => {
    (globalThis.window as any).navigation = { navigate: () => {} };
    expect(supportsNavigationApi()).toBe(false);
  });

  it("should return false if navigate is missing", () => {
    (globalThis.window as any).navigation = { addEventListener: () => {} };
    expect(supportsNavigationApi()).toBe(false);
  });

  it("should return true if both addEventListener and navigate are functions", () => {
    (globalThis.window as any).navigation = {
      addEventListener: () => {},
      navigate: () => {},
    };
    expect(supportsNavigationApi()).toBe(true);
  });
});
