import path from "node:path";

export function getRoutesCandidates(contentRoot) {
  const relativeList = [
    "pages/resources/routes.json",
    "pages/deps/routes.json",
    "resources/routes.json",
    "deps/routes.json",
    "pages/routes.json",
    "routes.json",
  ];

  if (contentRoot) {
    return relativeList.map((p) => path.join(contentRoot, p));
  }

  return relativeList;
}
