import path from "node:path";
import { getSiteConfigCandidates } from "./get-site-config-candidates.mjs";

describe("getSiteConfigCandidates", () => {
  it("returns only the root site-config path when no contentRoot is passed", () => {
    expect(getSiteConfigCandidates()).toEqual(["site-config.json"]);
  });

  it("returns candidates resolved against contentRoot when provided", () => {
    const root = "/custom/template";
    expect(getSiteConfigCandidates(root)).toEqual([
      path.join(root, "site-config.json"),
      path.join(root, "pages/site-config.json"),
    ]);
  });
});
