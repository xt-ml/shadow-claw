import { getRoutesCandidates } from "./get-routes-candidates.mjs";

describe("getRoutesCandidates", () => {
  it("returns routes candidate list in priority order", () => {
    expect(getRoutesCandidates()).toEqual([
      "pages/resources/routes.json",
      "pages/deps/routes.json",
      "resources/routes.json",
      "deps/routes.json",
      "pages/routes.json",
      "routes.json",
    ]);
  });
});
