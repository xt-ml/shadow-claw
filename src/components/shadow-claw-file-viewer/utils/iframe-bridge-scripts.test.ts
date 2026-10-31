import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FILE_VIEWER_PREVIEW_BRIDGE_SCRIPT,
  IFRAME_STORAGE_BRIDGE_SCRIPT,
  safeInlineScript,
} from "./iframe-bridge-scripts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("iframe-bridge-scripts", () => {
  it("matches on-disk iframe-storage-bridge.js content", () => {
    const filePath = path.resolve(__dirname, "../iframe-storage-bridge.js");
    const onDiskContent = fs.readFileSync(filePath, "utf-8");
    expect(IFRAME_STORAGE_BRIDGE_SCRIPT).toBe(onDiskContent);
  });

  it("matches on-disk file-viewer-preview-bridge.js content", () => {
    const filePath = path.resolve(
      __dirname,
      "../file-viewer-preview-bridge.js",
    );
    const onDiskContent = fs.readFileSync(filePath, "utf-8");
    expect(FILE_VIEWER_PREVIEW_BRIDGE_SCRIPT).toBe(onDiskContent);
  });

  it("safeInlineScript escapes closing script tags", () => {
    const input = 'const x = "</script><script>alert(1)</SCRIPT>";';
    const escaped = safeInlineScript(input);
    expect(escaped).not.toContain("</script>");
    expect(escaped).not.toContain("</SCRIPT>");
    expect(escaped).toContain("<\\/script>");
    expect(escaped).toContain("<\\/SCRIPT>");
  });
});
