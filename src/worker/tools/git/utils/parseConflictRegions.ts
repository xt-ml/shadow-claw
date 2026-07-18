import { ConflictRegion } from "../git.js";

export function parseConflictRegions(content: string): ConflictRegion[] {
  const regions: ConflictRegion[] = [];
  const lines = content.split("\n");

  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith("<<<<<<<")) {
      const oursLabel = lines[i].slice(8).trim();
      const oursLines: string[] = [];
      const theirsLines: string[] = [];

      let inTheirs = false;

      const startLine = i + 1;

      i++;

      while (i < lines.length && !lines[i].startsWith(">>>>>>>")) {
        if (lines[i].startsWith("=======")) {
          inTheirs = true;
        } else if (inTheirs) {
          theirsLines.push(lines[i]);
        } else {
          oursLines.push(lines[i]);
        }

        i++;
      }

      const theirsLabel = i < lines.length ? lines[i].slice(8).trim() : "";
      regions.push({
        ours: oursLines.join("\n"),
        oursLabel,
        startLine,
        theirs: theirsLines.join("\n"),
        theirsLabel,
      });
    }

    i++;
  }

  return regions;
}
