import { jest } from "@jest/globals";
import { renderVideo } from "./video.js";
import type { VideoSpec } from "../../../ui/a2ui.js";

describe("renderVideo", () => {
  it("renders a video element with resolved URL", () => {
    const spec: VideoSpec = {
      id: "test-video",
      component: "Video",
      url: "https://example.com/video.mp4",
    };

    const ctx = {
      resolveMediaUrl: jest.fn().mockImplementation((url: any) => url) as any,
    };

    const el = renderVideo(spec, { dataModel: {} } as any, ctx);

    expect(el.tagName).toBe("VIDEO");
    expect(el.className).toBe("a2ui__video");
    const videoEl = el as HTMLVideoElement;
    expect(videoEl.src).toBe("https://example.com/video.mp4");
    expect(videoEl.controls).toBe(true);
  });

  it("handles workspace URLs for both src and poster", () => {
    const spec: VideoSpec = {
      id: "test-video",
      component: "Video",
      url: "/files/workspace/video.mp4",
      posterUrl: "/files/workspace/poster.jpg",
    };

    const ctx = {
      resolveMediaUrl: jest.fn().mockImplementation((url: any) => url) as any,
    };

    const el = renderVideo(
      spec,
      { dataModel: {} } as any,
      ctx,
    ) as HTMLVideoElement;

    expect(el.getAttribute("data-a2ui-workspace-src")).toBe(
      "/files/workspace/video.mp4",
    );
    expect(el.src).toBe(""); // should not set src directly

    expect(el.getAttribute("data-a2ui-workspace-poster")).toBe(
      "/files/workspace/poster.jpg",
    );
    expect(el.poster).toBe("");
  });
});
