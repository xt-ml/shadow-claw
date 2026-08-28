import { describe, it, expect, jest } from "@jest/globals";
import { syncIframeTheme } from "./syncIframeTheme.js";

describe("syncIframeTheme", () => {
  it("does nothing when targetWindow is null", () => {
    expect(() => syncIframeTheme(null)).not.toThrow();
  });

  it("posts shadow-claw-theme-update message to window with theme mode and custom properties", () => {
    const mockPostMessage = jest.fn();
    const mockWindow = { postMessage: mockPostMessage } as unknown as Window;

    document.documentElement.classList.add("dark-mode");
    syncIframeTheme(mockWindow);

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "shadow-claw-theme-update",
        theme: "dark",
      }),
      "*",
    );
    document.documentElement.classList.remove("dark-mode");
  });
});
