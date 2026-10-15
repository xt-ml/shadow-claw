import { handleSpecialLinkNavigation, sanitizeHtml } from "./utils.js";
import { jest } from "@jest/globals";

describe("utils", () => {
  describe("handleSpecialLinkNavigation", () => {
    let mockDispatch: any;

    beforeEach(() => {
      mockDispatch = jest.fn();
      jest
        .spyOn(document, "dispatchEvent")
        .mockImplementation(mockDispatch as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("returns false for empty or external URLs", () => {
      expect(handleSpecialLinkNavigation("")).toBe(false);
      expect(handleSpecialLinkNavigation("   ")).toBe(false);
      expect(handleSpecialLinkNavigation("http://example.com")).toBe(false);
      expect(handleSpecialLinkNavigation("https://example.com")).toBe(false);
      expect(handleSpecialLinkNavigation("//example.com")).toBe(false);
      expect(handleSpecialLinkNavigation("javascript:void(0)")).toBe(false);
    });

    it("handles special hash links like #chat", () => {
      const result = handleSpecialLinkNavigation("#chat?groupId=room-1");
      expect(result).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-navigate",
          detail: expect.objectContaining({
            page: "chat",
            groupId: "room-1",
          }),
        }),
      );
    });

    it("handles relative workspace paths like docs/README.md", () => {
      const result = handleSpecialLinkNavigation("docs/README.md");
      expect(result).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-navigate",
          detail: expect.objectContaining({
            page: "files",
            path: "docs/README.md",
          }),
        }),
      );
    });
  });

  describe("sanitizeHtml", () => {
    it("sanitizes unsafe script tags from HTML", () => {
      const sanitized = sanitizeHtml("<script>alert(1)</script><p>Safe</p>");
      expect(sanitized).toBe("<p>Safe</p>");
    });
  });
});
