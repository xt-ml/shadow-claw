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
});
