import {
  formatDateForFilename,
  formatTimestamp,
  handleSpecialLinkNavigation,
} from "./utils.js";
import { jest } from "@jest/globals";

describe("utils", () => {
  it("formats date for file names", () => {
    const s = formatDateForFilename(new Date(2024, 0, 2, 3, 4, 5));

    expect(s).toMatch(/^2024-01-02_03-04-05$/);
  });

  it("formats timestamp string", () => {
    const s = formatTimestamp(Date.UTC(2024, 0, 1, 13, 25));

    expect(typeof s).toBe("string");

    expect(s.length).toBeGreaterThan(5);
  });

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

    it("should intercept and dispatch shadow-claw-navigate for valid page links", () => {
      const result = handleSpecialLinkNavigation(
        "/#Files",
        "base.md",
        "group-1",
      );
      expect(result).toBe(true);
      expect(mockDispatch).toHaveBeenCalled();
      const event = mockDispatch.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe("shadow-claw-navigate");
      expect(event.detail.page).toBe("files");
      expect(event.detail.groupId).toBe("group-1");
      // No path or anchor on a bare page link
      expect(event.detail.path).toBeUndefined();
      expect(event.detail.anchor).toBeUndefined();
    });

    it("should extract query parameters (groupId, path) and anchor from URL hash", () => {
      const url =
        "/#Files?groupId=test-group&path=src/components/button.ts#L10-L20";
      const result = handleSpecialLinkNavigation(url, "base.md", "group-1");
      expect(result).toBe(true);
      expect(mockDispatch).toHaveBeenCalled();
      const event = mockDispatch.mock.calls[0][0] as CustomEvent;
      expect(event.detail.page).toBe("files");
      expect(event.detail.groupId).toBe("test-group");
      expect(event.detail.path).toBe("src/components/button.ts");
      // anchor stored without leading #
      expect(event.detail.anchor).toBe("L10-L20");
    });

    it("should support ?anchor= query param for heading navigation", () => {
      const url =
        "/#Files?groupId=test-group&path=no-wai.md&anchor=yes-it-does";
      const result = handleSpecialLinkNavigation(url, "", "group-1");
      expect(result).toBe(true);
      expect(mockDispatch).toHaveBeenCalled();
      const event = mockDispatch.mock.calls[0][0] as CustomEvent;
      expect(event.detail.anchor).toBe("yes-it-does");
      expect(event.detail.path).toBe("no-wai.md");
    });

    it("should handle malformed query strings with multiple question marks gracefully", () => {
      const url =
        "/#Files?groupId=test-group?path=no-wai.md?anchor=yes-it-does";
      const result = handleSpecialLinkNavigation(url, "", "group-1");
      expect(result).toBe(true);
      expect(mockDispatch).toHaveBeenCalled();
      const event = mockDispatch.mock.calls[0][0] as CustomEvent;
      expect(event.detail.page).toBe("files");
      expect(event.detail.groupId).toBe("test-group");
      expect(event.detail.path).toBe("no-wai.md");
      expect(event.detail.anchor).toBe("yes-it-does");
    });

    it("should resolve workspace-relative files as file navigate events", () => {
      const result = handleSpecialLinkNavigation(
        "utils.ts",
        "src/components/button.ts",
        "group-1",
      );
      expect(result).toBe(true);
      expect(mockDispatch).toHaveBeenCalled();
      const event = mockDispatch.mock.calls[0][0] as CustomEvent;
      expect(event.detail.page).toBe("files");
      expect(event.detail.groupId).toBe("group-1");
      expect(event.detail.path).toBe("src/components/utils.ts");
      // No anchor present for a plain relative link
      expect(event.detail.anchor).toBeUndefined();
    });

    it("should not intercept external links", () => {
      const result = handleSpecialLinkNavigation(
        "https://example.com/index.html",
        "base.md",
        "group-1",
      );
      expect(result).toBe(false);
      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });
});
