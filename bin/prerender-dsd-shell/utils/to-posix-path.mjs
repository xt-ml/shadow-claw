import path from "node:path";

export function toPosixPath(inputPath) {
  return inputPath.split(path.sep).join("/");
}
