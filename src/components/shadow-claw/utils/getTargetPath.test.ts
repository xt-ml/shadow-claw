import { jest } from "@jest/globals";

import { getTargetPath } from "./getTargetPath";

describe("getTargetPath", () => {
  test("should return the target path from a URL", () => {
    const loc = {
      origin: "https://example.com",
      pathname: "/old",
      search: "",
      hash: "",
    } as Location;

    const link = {
      href: "https://example.com/path",
      origin: "https://example.com",
      target: "_self",
      pathname: "/path",
      search: "",
      hash: "",
      getAttribute: () => "https://example.com/path",
    };
    Object.setPrototypeOf(link, HTMLAnchorElement.prototype);

    const ev = {
      preventDefault: jest.fn(),
      button: 0,
      composedPath: () => [link],
    } as unknown as MouseEvent;
    expect(getTargetPath(loc, ev)).toBe("/path");
  });

  test("should return null for modified clicks", () => {
    const loc = { origin: "https://example.com" } as Location;
    const ev = { button: 0, metaKey: true } as unknown as MouseEvent;
    expect(getTargetPath(loc, ev)).toBeNull();

    const ev2 = { defaultPrevented: true } as unknown as MouseEvent;
    expect(getTargetPath(loc, ev2)).toBeNull();
  });

  test("should return null if no link was clicked", () => {
    const loc = { origin: "https://example.com" } as Location;

    const ev = {
      button: 0,
      composedPath: () => [document.createElement("div")],
    } as unknown as MouseEvent;
    expect(getTargetPath(loc, ev)).toBeNull();
  });

  test("should return null for empty or invalid protocols", () => {
    const loc = { origin: "https://example.com" } as Location;

    const link = Object.assign(document.createElement("a"), {
      href: "javascript:void(0)",
    });

    const ev = {
      button: 0,
      composedPath: () => [link],
    } as unknown as MouseEvent;

    expect(getTargetPath(loc, ev)).toBeNull();

    link.href = "mailto:test@test.com";

    expect(getTargetPath(loc, ev)).toBeNull();
  });

  test("should return null for external targets", () => {
    const loc = { origin: "https://example.com" } as Location;

    const link = Object.assign(document.createElement("a"), {
      href: "https://example.com/path",
      target: "_blank",
    });
    link.setAttribute("href", link.href);

    const ev = {
      button: 0,
      composedPath: () => [link],
    } as unknown as MouseEvent;

    expect(getTargetPath(loc, ev)).toBeNull();
  });

  test("should return null for external domains", () => {
    const loc = { origin: "https://example.com" } as Location;

    const link = Object.assign(document.createElement("a"), {
      href: "https://another.com/path",
    });

    link.setAttribute("href", link.href);

    const ev = {
      button: 0,
      composedPath: () => [link],
    } as unknown as MouseEvent;
    expect(getTargetPath(loc, ev)).toBeNull();
  });

  test("should return null for hash-only changes on current page", () => {
    const loc = {
      origin: "https://example.com",
      pathname: "/path",
      search: "?q=1",
      hash: "#old",
    } as Location;

    const link = Object.assign(document.createElement("a"), {
      href: "https://example.com/path?q=1#new",
    });

    link.setAttribute("href", link.href);

    const ev = {
      button: 0,
      composedPath: () => [link],
    } as unknown as MouseEvent;
    expect(getTargetPath(loc, ev)).toBeNull();
  });
});
