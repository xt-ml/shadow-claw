import { getSiteConfigCandidates } from "./get-site-config-candidates.mjs";

describe("getSiteConfigCandidates", () => {
  it("returns only the root site-config path", () => {
    expect(getSiteConfigCandidates()).toEqual(["site-config.json"]);
  });
});
