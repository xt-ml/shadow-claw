import path from "node:path";

export function toPosixPath(inputPath: string): string {
  return inputPath.split(path.sep).join("/");
}
