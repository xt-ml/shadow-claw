import { describe, expect, it } from "@jest/globals";
import { renderImage } from "./image.js";

describe("renderImage", () => {
  it("renders image with default variant and fill fit", () => {
    const spec = {
      type: "image" as const,
      url: "https://example.com/test.png",
      description: "A test image",
    };
    const surface = { dataModel: {} } as any;
    const ctx = {
      resolveMediaUrl: (url: string) => url,
    };

    const el = renderImage(spec as any, surface, ctx) as HTMLImageElement;
    expect(el.tagName).toBe("IMG");
    expect(el.className).toBe("a2ui__image a2ui__image--mediumFeature");
    expect(el.src).toBe("https://example.com/test.png");
    expect(el.alt).toBe("A test image");
    expect(el.style.objectFit).toBe("fill");
  });

  it("handles workspace /files/ URL and custom variant, fit, weight", () => {
    const spec = {
      type: "image" as const,
      variant: "avatar" as const,
      src: "/workspace/photo.jpg",
      fit: "cover" as const,
      weight: 2,
    };
    const surface = { dataModel: {} } as any;
    const ctx = {
      resolveMediaUrl: () => "/files/main/photo.jpg",
    };

    const el = renderImage(spec as any, surface, ctx) as HTMLImageElement;
    expect(el.className).toBe("a2ui__image a2ui__image--avatar");
    expect(el.getAttribute("data-a2ui-workspace-src")).toBe(
      "/files/main/photo.jpg",
    );
    expect(el.style.objectFit).toBe("cover");
    expect(el.alt).toBe("");
  });

  it("handles source, imageUrl fallbacks and empty resolvedUrl", () => {
    const surface = { dataModel: {} } as any;
    const ctx = {
      resolveMediaUrl: () => "",
    };

    const elSource = renderImage(
      { type: "image", source: "src.jpg" } as any,
      surface,
      ctx,
    ) as HTMLImageElement;
    expect(elSource.src).toBe("");

    const elImgUrl = renderImage(
      { type: "image", imageUrl: "img.jpg" } as any,
      surface,
      ctx,
    ) as HTMLImageElement;
    expect(elImgUrl.src).toBe("");

    const elEmpty = renderImage(
      { type: "image" } as any,
      surface,
      ctx,
    ) as HTMLImageElement;
    expect(elEmpty.src).toBe("");
  });
});
