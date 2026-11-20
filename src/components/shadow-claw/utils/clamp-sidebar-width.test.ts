import { jest } from "@jest/globals";

import {
  MAX_SIDEBAR_WIDTH_PX,
  MIN_SIDEBAR_WIDTH_PX,
  SIDEBAR_COLLAPSED_WIDTH_PX,
} from "../constants.js";
import { clampSidebarWidth } from "./clamp-sidebar-width.js";

describe("clampSidebarWidth", () => {
  let shadowRootMock: ShadowRoot | null;
  let appBodyMock: HTMLElement;

  beforeEach(() => {
    // Use a real HTMLElement so instanceof checks pass
    appBodyMock = document.createElement("div");

    shadowRootMock = {
      querySelector: jest.fn(),
    } as unknown as ShadowRoot;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should define MIN_SIDEBAR_WIDTH_PX as 175 and SIDEBAR_COLLAPSED_WIDTH_PX as 0", () => {
    expect(MIN_SIDEBAR_WIDTH_PX).toBe(175);
    expect(SIDEBAR_COLLAPSED_WIDTH_PX).toBe(0);
  });

  it("should return clamped value when shadowRoot is null", () => {
    const px = 150;
    const result = clampSidebarWidth(null, px);
    expect(result).toBe(
      Math.max(MIN_SIDEBAR_WIDTH_PX, Math.min(MAX_SIDEBAR_WIDTH_PX, px)),
    );
  });

  it("should return clamped value when shadowRoot.querySelector returns null", () => {
    shadowRootMock!.querySelector = jest.fn().mockReturnValue(null);

    const px = 150;
    const result = clampSidebarWidth(shadowRootMock, px);
    expect(result).toBe(
      Math.max(MIN_SIDEBAR_WIDTH_PX, Math.min(MAX_SIDEBAR_WIDTH_PX, px)),
    );
    expect(shadowRootMock!.querySelector).toHaveBeenCalledWith(".app-body");
  });

  it("should return clamped value when shadowRoot.querySelector returns non-HTMLElement", () => {
    shadowRootMock!.querySelector = jest.fn().mockReturnValue({});

    const px = 150;
    const result = clampSidebarWidth(shadowRootMock, px);
    expect(result).toBe(
      Math.max(MIN_SIDEBAR_WIDTH_PX, Math.min(MAX_SIDEBAR_WIDTH_PX, px)),
    );
  });

  it("should clamp px below MIN_SIDEBAR_WIDTH_PX (50, 0, -50) to 175", () => {
    shadowRootMock!.querySelector = jest.fn().mockReturnValue(appBodyMock);
    appBodyMock.getBoundingClientRect = jest
      .fn()
      .mockReturnValue({ width: 500 } as any) as any;

    expect(clampSidebarWidth(shadowRootMock, 50)).toBe(175);
    expect(clampSidebarWidth(shadowRootMock, 0)).toBe(175);
    expect(clampSidebarWidth(shadowRootMock, -50)).toBe(MIN_SIDEBAR_WIDTH_PX);
  });

  it("should preserve px when appBody width is 0 (unlaid-out DOM)", () => {
    shadowRootMock!.querySelector = jest.fn().mockReturnValue(appBodyMock);
    appBodyMock.getBoundingClientRect = jest
      .fn()
      .mockReturnValue({ width: 0 } as any) as any;

    expect(clampSidebarWidth(shadowRootMock, 250)).toBe(250);
  });

  it("should clamp px to max when px is greater than max", () => {
    shadowRootMock!.querySelector = jest.fn().mockReturnValue(appBodyMock);
    appBodyMock.getBoundingClientRect = jest
      .fn()
      .mockReturnValue({ width: 2000 } as any) as any;

    const px = 3000;
    const result = clampSidebarWidth(shadowRootMock, px);
    expect(result).toBe(MAX_SIDEBAR_WIDTH_PX);
  });

  it("should clamp px to maxByContainer floored at MIN_SIDEBAR_WIDTH_PX (175) when appBody width is 400", () => {
    shadowRootMock!.querySelector = jest.fn().mockReturnValue(appBodyMock);
    appBodyMock.getBoundingClientRect = jest
      .fn()
      .mockReturnValue({ width: 400 } as any) as any;

    const px = 250;
    const result = clampSidebarWidth(shadowRootMock, px);
    expect(result).toBe(175);
  });

  it("should return px when px is between min and max and less than maxByContainer", () => {
    shadowRootMock!.querySelector = jest.fn().mockReturnValue(appBodyMock);

    appBodyMock.getBoundingClientRect = jest
      .fn()
      .mockReturnValue({ width: 1000 } as any) as any;

    const px = 300;
    const result = clampSidebarWidth(shadowRootMock, px);
    expect(result).toBe(300);
  });

  it("should return maxByContainer when px is greater than maxByContainer but less than MAX_SIDEBAR_WIDTH_PX", () => {
    shadowRootMock!.querySelector = jest.fn().mockReturnValue(appBodyMock);
    appBodyMock.getBoundingClientRect = jest
      .fn()
      .mockReturnValue({ width: 500 } as any) as any;

    const px = 300;
    const result = clampSidebarWidth(shadowRootMock, px);
    expect(result).toBe(240);
  });
});
