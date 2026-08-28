import { describe, it, expect, jest } from "@jest/globals";
import { resolveMarkdownImages } from "./resolveMarkdownImages.js";

describe("resolveMarkdownImages", () => {
  it("does nothing if container has no image elements", async () => {
    const container = document.createElement("div");
    const readImageFn =
      jest.fn<(g: string, p: string) => Promise<string | null>>();

    await resolveMarkdownImages({
      container,
      groupId: "main",
      filePath: "doc.md",
      groups: [],
      readImageAsDataUrlFn: readImageFn,
    });

    expect(readImageFn).not.toHaveBeenCalled();
  });

  it("resolves relative workspace images and sets data URL src", async () => {
    const container = document.createElement("div");
    const img = document.createElement("img");
    img.setAttribute("src", "./logo.png");
    container.appendChild(img);

    const readImageFn = jest
      .fn<(g: string, p: string) => Promise<string | null>>()
      .mockResolvedValue("data:image/png;base64,12345");

    await resolveMarkdownImages({
      container,
      groupId: "main",
      filePath: "doc.md",
      groups: [],
      readImageAsDataUrlFn: readImageFn,
    });

    expect(readImageFn).toHaveBeenCalledWith("main", "logo.png");
    expect(img.getAttribute("src")).toBe("data:image/png;base64,12345");
  });
});
