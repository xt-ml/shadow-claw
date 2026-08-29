import path from "node:path";
import { getRoutesCandidates } from "./get-routes-candidates.mjs";

describe("getRoutesCandidates", () => {
  it("returns routes candidate list in priority order when no contentRoot is passed", () => {
    expect(getRoutesCandidates()).toEqual([
      "pages/resources/routes.json",
      "pages/deps/routes.json",
      "resources/routes.json",
      "deps/routes.json",
      "pages/routes.json",
      "routes.json",
    ]);
  });

  it("returns routes candidate list resolved against contentRoot when provided", () => {
    const root = "/custom/template";
    expect(getRoutesCandidates(root)).toEqual([
      path.join(root, "pages/resources/routes.json"),
      path.join(root, "pages/deps/routes.json"),
      path.join(root, "resources/routes.json"),
      path.join(root, "deps/routes.json"),
      path.join(root, "pages/routes.json"),
      path.join(root, "routes.json"),
    ]);
  });
});
