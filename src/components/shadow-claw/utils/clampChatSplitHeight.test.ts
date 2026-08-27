import { jest } from "@jest/globals";
import { MIN_CHAT_SPLIT_HEIGHT_PX } from "../constants.js";
import { clampChatSplitHeight } from "./clampChatSplitHeight.js";

describe("clampChatSplitHeight", () => {
  it("should clamp below minimum height", () => {
    const result = clampChatSplitHeight(null, 50);
    expect(result).toBe(MIN_CHAT_SPLIT_HEIGHT_PX);
  });

  it("should return valid height when within limits", () => {
    const result = clampChatSplitHeight(null, 300);
    expect(result).toBe(300);
  });

  it("should clamp height based on container height if available", () => {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const mainContent = document.createElement("div");
    mainContent.classList.add("main-content");
    jest.spyOn(mainContent, "getBoundingClientRect").mockReturnValue({
      height: 500,
      width: 800,
      top: 0,
      left: 0,
      right: 800,
      bottom: 500,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    shadow.appendChild(mainContent);

    // Container height is 500, max allowed is 500 - 100 = 400.
    const result = clampChatSplitHeight(shadow, 600);
    expect(result).toBe(400);
  });
});
