import { getPrerenderSkeletonDefault } from "./prerender-skeleton-default.js";

const META_NAME = "shadow-claw-override-prerender-skeleton";

function setMeta(content: string) {
  const meta = document.createElement("meta");
  meta.setAttribute("name", META_NAME);
  meta.setAttribute("content", content);
  document.head.appendChild(meta);
}

describe("getPrerenderSkeletonDefault", () => {
  afterEach(() => {
    document.head
      .querySelectorAll(`meta[name="${META_NAME}"]`)
      .forEach((m) => m.remove());
  });

  it("falls back to false when no meta tag exists", () => {
    expect(getPrerenderSkeletonDefault()).toBe(false);
  });

  it("returns true when the site-config meta tag says true", () => {
    setMeta("true");
    expect(getPrerenderSkeletonDefault()).toBe(true);
  });

  it("returns false when the site-config meta tag says false", () => {
    setMeta("false");
    expect(getPrerenderSkeletonDefault()).toBe(false);
  });

  it("ignores unrecognised meta values", () => {
    setMeta("banana");
    expect(getPrerenderSkeletonDefault()).toBe(false);
  });
});
