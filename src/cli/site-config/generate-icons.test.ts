import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  ICON_SIZES,
  SHADOW_CLAW_DEFAULT_ICON_SHA256,
  buildMonogramSvg,
  encodeIcoFromPngBuffers,
  ensureTemplateIconSet,
  extractSvgFromLogoSlotHtml,
  isDefaultShadowClawIconBuffer,
  prepareSvgForRasterization,
  renderIconPngBuffer,
} from "./generate-icons.js";

function readPngDimensions(buf: Buffer): { width: number; height: number } {
  // PNG signature is 8 bytes, followed by IHDR chunk (4-byte length, 4-byte 'IHDR', 4-byte width, 4-byte height)
  expect(buf.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

describe("generate-icons", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(
      os.tmpdir(),
      `sc-generate-icons-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("extractSvgFromLogoSlotHtml", () => {
    it("extracts an inline <svg> element and removes header-specific class attributes", () => {
      const slot =
        '<svg class="header-title-logo" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="10" fill="#38bdf8"/></svg>';
      const svg = extractSvgFromLogoSlotHtml(slot);
      expect(svg).not.toBeNull();
      expect(svg).toContain('viewBox="0 0 32 32"');
      expect(svg).toContain('<circle cx="16" cy="16" r="10" fill="#38bdf8"/>');
    });

    it("returns null for empty, 'none', or non-SVG strings", () => {
      expect(extractSvgFromLogoSlotHtml("")).toBeNull();
      expect(extractSvgFromLogoSlotHtml("none")).toBeNull();
      expect(extractSvgFromLogoSlotHtml("<img src='logo.png' />")).toBeNull();
      expect(extractSvgFromLogoSlotHtml(null)).toBeNull();
    });
  });

  describe("prepareSvgForRasterization", () => {
    it("sets explicit pixel width and height on the root <svg> element while preserving viewBox", () => {
      const rawSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#060d14"/><circle cx="16" cy="16" r="6" fill="#38bdf8"/></svg>';
      const prepared = prepareSvgForRasterization(rawSvg, 512);
      expect(prepared).toContain('width="512"');
      expect(prepared).toContain('height="512"');
      expect(prepared).toContain('viewBox="0 0 32 32"');
    });

    it("replaces percentage width/height with target pixel dimensions", () => {
      const rawSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><rect width="100" height="100" fill="#0f172a"/></svg>';
      const prepared = prepareSvgForRasterization(rawSvg, 180);
      expect(prepared).toContain('width="180"');
      expect(prepared).toContain('height="180"');
      expect(prepared).not.toContain('width="100%"');
    });
  });

  describe("buildMonogramSvg", () => {
    it("builds a valid SVG monogram badge from site title and colors", () => {
      const svg = buildMonogramSvg("Karl Herrick", "#134e4a", "#0a0a0f");
      expect(svg).toContain("<svg");
      expect(svg).toContain("#134e4a");
      expect(svg).toContain("#0a0a0f");
      expect(svg).toContain("KH");
    });
  });

  describe("renderIconPngBuffer & encodeIcoFromPngBuffers", () => {
    it("renders crisp PNG buffers at exact pixel dimensions from an SVG", async () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
        <rect width="32" height="32" rx="8" fill="#060d14"/>
        <circle cx="16" cy="16" r="8" fill="#38bdf8"/>
      </svg>`;

      const png180 = await renderIconPngBuffer({ type: "svg", svg }, 180);
      expect(readPngDimensions(png180)).toEqual({ width: 180, height: 180 });

      const png512 = await renderIconPngBuffer({ type: "svg", svg }, 512);
      expect(readPngDimensions(png512)).toEqual({ width: 512, height: 512 });
    });

    it("encodes a valid multi-frame ICO file from PNG buffers", async () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
        <rect width="32" height="32" rx="8" fill="#060d14"/>
        <circle cx="16" cy="16" r="8" fill="#38bdf8"/>
      </svg>`;
      const png16 = await renderIconPngBuffer({ type: "svg", svg }, 16);
      const png32 = await renderIconPngBuffer({ type: "svg", svg }, 32);
      const png48 = await renderIconPngBuffer({ type: "svg", svg }, 48);

      const ico = encodeIcoFromPngBuffers([
        { size: 16, png: png16 },
        { size: 32, png: png32 },
        { size: 48, png: png48 },
      ]);

      // ICO header: reserved=0 (2B), type=1 (2B), count=3 (2B)
      expect(ico.readUInt16LE(0)).toBe(0);
      expect(ico.readUInt16LE(2)).toBe(1);
      expect(ico.readUInt16LE(4)).toBe(3);
      // First entry width=16, height=16
      expect(ico.readUInt8(6)).toBe(16);
      expect(ico.readUInt8(7)).toBe(16);
      // Third entry width=48, height=48
      expect(ico.readUInt8(6 + 32)).toBe(48);
      expect(ico.readUInt8(7 + 32)).toBe(48);
    });
  });

  describe("ensureTemplateIconSet", () => {
    it("synthesizes all raster PNG sizes, apple-touch-icon.png, and favicon.ico from a template favicon.svg", async () => {
      const iconsDir = path.join(tmpDir, "assets/icons");
      await mkdir(iconsDir, { recursive: true });

      const customSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
        <rect width="32" height="32" rx="8" fill="#060d14"/>
        <circle cx="16" cy="16" r="7" fill="#38bdf8"/>
      </svg>`;
      await writeFile(path.join(iconsDir, "favicon.svg"), customSvg, "utf8");

      const result = await ensureTemplateIconSet({
        targetIconsDir: iconsDir,
        config: {
          site: { title: "LightMeter", themeColor: "#060d14" },
          branding: { faviconPath: "assets/icons/favicon.svg" },
        },
      });

      expect(result.generatedFiles.length).toBeGreaterThanOrEqual(
        ICON_SIZES.length + 1,
      );

      for (const size of ICON_SIZES) {
        const pngBuf = await readFile(path.join(iconsDir, `${size}.png`));
        expect(readPngDimensions(pngBuf)).toEqual({
          width: size,
          height: size,
        });
        expect(isDefaultShadowClawIconBuffer(pngBuf)).toBe(false);
      }

      const appleBuf = await readFile(
        path.join(iconsDir, "apple-touch-icon.png"),
      );
      expect(readPngDimensions(appleBuf)).toEqual({ width: 180, height: 180 });

      const icoBuf = await readFile(path.join(iconsDir, "favicon.ico"));
      expect(icoBuf.readUInt16LE(2)).toBe(1);
      expect(isDefaultShadowClawIconBuffer(icoBuf)).toBe(false);
    });

    it("overwrites existing default ShadowClaw red lobster icons when a template has custom branding", async () => {
      const iconsDir = path.join(tmpDir, "assets/icons");
      await mkdir(iconsDir, { recursive: true });

      // Copy real ShadowClaw red lobster 180.png and 512.png into iconsDir
      const repoRoot = path.resolve(
        new URL("../../..", import.meta.url).pathname,
      );
      const lobster180 = await readFile(
        path.join(repoRoot, "assets/icons/180.png"),
      );
      const lobster512 = await readFile(
        path.join(repoRoot, "assets/icons/512.png"),
      );
      expect(SHADOW_CLAW_DEFAULT_ICON_SHA256.size).toBe(10);
      expect(isDefaultShadowClawIconBuffer(lobster180)).toBe(true);
      expect(isDefaultShadowClawIconBuffer(lobster512)).toBe(true);

      await writeFile(path.join(iconsDir, "180.png"), lobster180);
      await writeFile(path.join(iconsDir, "512.png"), lobster512);

      const dawLogoSlot =
        '<svg class="header-title-logo" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="8" fill="#10b981" fill-opacity="0.15"/><path d="M10 20V12M14 24V8M18 22V10M22 18V14" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/></svg>';

      await ensureTemplateIconSet({
        targetIconsDir: iconsDir,
        config: {
          site: { title: "ShadowClaw DAW", themeColor: "#090d16" },
          branding: {
            titleText: "ShadowClaw DAW",
            logoSlotHtml: dawLogoSlot,
          },
        },
      });

      const updated180 = await readFile(path.join(iconsDir, "180.png"));
      const updated512 = await readFile(path.join(iconsDir, "512.png"));
      expect(isDefaultShadowClawIconBuffer(updated180)).toBe(false);
      expect(isDefaultShadowClawIconBuffer(updated512)).toBe(false);
      expect(readPngDimensions(updated180)).toEqual({
        width: 180,
        height: 180,
      });
      expect(readPngDimensions(updated512)).toEqual({
        width: 512,
        height: 512,
      });

      const generatedSvg = await readFile(
        path.join(iconsDir, "favicon.svg"),
        "utf8",
      );
      expect(generatedSvg).toContain("M10 20V12M14 24V8");
    });

    it("synthesizes missing sizes (e.g. 180.png, 1024.png, favicon.svg) from an existing custom PNG icon", async () => {
      const iconsDir = path.join(tmpDir, "assets/icons");
      await mkdir(iconsDir, { recursive: true });

      const seedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <rect width="64" height="64" rx="12" fill="#111c12"/>
        <circle cx="32" cy="32" r="20" fill="#22c55e"/>
      </svg>`;
      const custom512 = await renderIconPngBuffer(
        { type: "svg", svg: seedSvg },
        512,
      );
      const custom512Hash = createHash("sha256")
        .update(custom512)
        .digest("hex");

      // Only provide 512.png
      await writeFile(path.join(iconsDir, "512.png"), custom512);

      await ensureTemplateIconSet({
        targetIconsDir: iconsDir,
        config: {
          site: { title: "Custom PNG Site", themeColor: "#111c12" },
        },
      });

      // Preserves existing custom 512.png
      const after512 = await readFile(path.join(iconsDir, "512.png"));
      expect(createHash("sha256").update(after512).digest("hex")).toBe(
        custom512Hash,
      );

      // Synthesizes missing 180.png, 1024.png, favicon.ico, favicon.svg
      const generated180 = await readFile(path.join(iconsDir, "180.png"));
      expect(readPngDimensions(generated180)).toEqual({
        width: 180,
        height: 180,
      });
      const generated1024 = await readFile(path.join(iconsDir, "1024.png"));
      expect(readPngDimensions(generated1024)).toEqual({
        width: 1024,
        height: 1024,
      });
      const generatedSvg = await readFile(
        path.join(iconsDir, "favicon.svg"),
        "utf8",
      );
      expect(generatedSvg).toContain("<svg");
      expect(
        (await stat(path.join(iconsDir, "favicon.ico"))).size,
      ).toBeGreaterThan(100);
    });
  });
});
