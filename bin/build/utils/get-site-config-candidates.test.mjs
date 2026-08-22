import { getSiteConfigCandidates } from "./get-site-config-candidates.mjs";

describe("getSiteConfigCandidates", () => {
  it("returns site-config candidate list in priority order", () => {
    expect(getSiteConfigCandidates()).toEqual([
      "pages/resources/site-config.json",
      "pages/deps/site-config.json",
      "resources/site-config.json",
      "deps/site-config.json",
      "pages/site-config.json",
      "site-config.json",
    ]);
  });
});
