import { getPublishCopyPlan } from "./get-publish-copy-plan.mjs";

describe("getPublishCopyPlan", () => {
  it("returns publish copy plan entries for docs and core metadata", () => {
    const plan = getPublishCopyPlan();

    expect(
      plan.find((entry) => entry.dest === "dist/public/README.md"),
    ).toBeTruthy();
    expect(plan.find((entry) => entry.dest === "dist/public/docs")).toEqual(
      expect.objectContaining({
        opts: { recursive: true },
      }),
    );
    expect(
      plan.find((entry) => entry.dest === "dist/public/robots.txt"),
    ).toBeTruthy();
    expect(
      plan.find((entry) => entry.dest === "dist/public/manifest.json"),
    ).toBeTruthy();
    expect(
      plan.find((entry) => entry.dest === "dist/public/favicon.svg"),
    ).toBeTruthy();
    expect(
      plan.find((entry) => entry.dest === "dist/public/favicon.ico"),
    ).toBeTruthy();
  });

  it("resolves sources and dest with custom contentRoot and distPublicDir", () => {
    const contentRoot = "/custom/content";
    const distPublicDir = "/custom/content/dist/public";
    const plan = getPublishCopyPlan({ contentRoot, distPublicDir });

    const readmeEntry = plan.find(
      (entry) => entry.dest === "/custom/content/dist/public/README.md",
    );
    expect(readmeEntry).toBeTruthy();
    expect(readmeEntry.sources).toContain("/custom/content/README.md");
    expect(readmeEntry.sources).toContain("/custom/content/pages/README.md");
  });
});
