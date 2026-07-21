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
});
