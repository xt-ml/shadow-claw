import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";

import type { SiteConfig } from "./apply.js";

export const ICON_SIZES = [48, 72, 96, 128, 152, 180, 192, 512, 1024] as const;

/**
 * Exact SHA-256 hex digests of ShadowClaw's bundled default red lobster icons
 * in `assets/icons/{48..1024}.png` and `assets/icons/favicon.ico`.
 */
export const SHADOW_CLAW_DEFAULT_ICON_SHA256: ReadonlySet<string> = new Set([
  "33a5914fdb9b42c622ceb4bdfd421d7c8792ce3809a10acc83dd356a975c1f66", // 48.png
  "a48ba6e50b2f8c54ee08480cb131365372757e9677e71fb09996395e3dacc086", // 72.png
  "1c7002983e6a36a309914466acf7aa98044b95e7fb940c17a03189638aa54a1d", // 96.png
  "4c1f774f8df852836dfbac0ac9400f0ae9fe9d3f340379f7588dbfee599c8e59", // 128.png
  "7d8bb2f52284861d86f389820f887c9b804e15f347cc3b38777612abc3c37e1f", // 152.png
  "9898621a296cc836d79a2b8881fe126bd73823eb53a8fbabbb9a0761e0280cc4", // 180.png
  "46fe87f35e8d62257eda46149045bad8edd8e382d22f0df92a4a635e0286e8a0", // 192.png
  "02c2881dbb68aa86e5e499c38c893386c1af4f048d557438987b7c2e7286eace", // 512.png
  "423e9e930bd88b9e7f28087b1a1a26e55f6c75426996d10172596e939833f5f2", // 1024.png
  "035f49ba449226300ac237220e8a5ed0472ea77885dee63a978f3db35128adda", // favicon.ico
]);

/**
 * Exact SHA-256 hex digests of ShadowClaw's default application screenshots.
 */
export const SHADOW_CLAW_DEFAULT_SCREENSHOT_SHA256: ReadonlySet<string> =
  new Set([
    "8aa7e215fa7ebe34bb5a12f1842f75caa365659733c460caa42d038afe25911b", // shadow-claw-screenshot-1920x1052.png
    "7997952cc418887610d1d24d3306805ccf028d9b6f73740d456042eb0592f5e9", // shadow-claw-screenshot-731x1045.png
    "7ad79ce4fd515228f24be8f8130bebb542fba1f538d6c537f45e2061fd4ea976", // shadow-claw-screenshot-1024x768.png
  ]);

export function computeSha256Hex(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function isDefaultShadowClawIconBuffer(buf: Buffer): boolean {
  return SHADOW_CLAW_DEFAULT_ICON_SHA256.has(computeSha256Hex(buf));
}

export function extractSvgFromLogoSlotHtml(
  logoSlotHtml?: string | null,
): string | null {
  if (!logoSlotHtml || typeof logoSlotHtml !== "string") {
    return null;
  }
  const trimmed = logoSlotHtml.trim();
  if (!trimmed || trimmed.toLowerCase() === "none") {
    return null;
  }
  const match = trimmed.match(/<svg\b[\s\S]*?<\/svg>/iu);
  if (!match) {
    return null;
  }
  let svg = match[0];
  if (svg.includes("--shadow-claw-icon-bg")) {
    return null;
  }
  svg = svg.replace(/\s+class="[^"]*"/iu, "");
  if (!/\bxmlns=/iu.test(svg)) {
    svg = svg.replace(/<svg\b/iu, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return svg;
}

export function prepareSvgForRasterization(
  svgText: string,
  size: number,
  backgroundColor?: string,
): string {
  let svg = svgText.trim();

  if (!/\bxmlns=/iu.test(svg)) {
    svg = svg.replace(/<svg\b/iu, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // Extract viewBox or derive one from width/height if missing
  const openTagMatch = svg.match(/<svg\b[^>]*>/iu);
  if (!openTagMatch) {
    return svg;
  }
  let openTag = openTagMatch[0];
  let viewBox = "0 0 32 32";
  const vbMatch = openTag.match(/\bviewBox=["']([^"']+)["']/iu);
  if (vbMatch) {
    viewBox = vbMatch[1];
  } else {
    const wMatch = openTag.match(/\bwidth=["'](\d+(?:\.\d+)?)["']/iu);
    const hMatch = openTag.match(/\bheight=["'](\d+(?:\.\d+)?)["']/iu);
    const w = wMatch ? wMatch[1] : "32";
    const h = hMatch ? hMatch[1] : "32";
    openTag = openTag.replace(/<svg\b/iu, `<svg viewBox="0 0 ${w} ${h}"`);
    viewBox = `0 0 ${w} ${h}`;
  }

  // Remove existing width and height attributes on <svg> and set explicit pixel dimensions
  openTag = openTag
    .replace(/\s+\bwidth=["'][^"']*["']/giu, "")
    .replace(/\s+\bheight=["'][^"']*["']/giu, "")
    .replace(/<svg\b/iu, `<svg width="${size}" height="${size}"`);

  svg = openTag + svg.slice(openTagMatch[0].length);

  // If the first rect has a low fill-opacity (like a header badge overlay) and backgroundColor is provided,
  // prepend an opaque rounded background rect so standalone icons aren't translucent on OS docks/iOS.
  if (backgroundColor && /\bfill-opacity=["']0\.[0-4]/iu.test(svg)) {
    const vbParts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const vbW = Number.isFinite(vbParts[2]) && vbParts[2] > 0 ? vbParts[2] : 32;
    const vbH = Number.isFinite(vbParts[3]) && vbParts[3] > 0 ? vbParts[3] : 32;
    const rx = Math.round(Math.min(vbW, vbH) * 0.22);
    const bgRect = `<rect width="${vbW}" height="${vbH}" rx="${rx}" fill="${backgroundColor}"/>`;
    svg = svg.replace(/(<svg\b[^>]*>)/iu, `$1${bgRect}`);
  }

  return svg;
}

export function buildMonogramSvg(
  title: string,
  themeColor = "#2563eb",
  backgroundColor = "#0f172a",
): string {
  const words = (title || "App")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let initials = "SC";
  if (words.length >= 2) {
    initials = (words[0][0] + words[1][0]).toUpperCase();
  } else if (words.length === 1 && words[0].length > 0) {
    initials = words[0].slice(0, 2).toUpperCase();
  }

  const safeBg =
    backgroundColor &&
    backgroundColor !== "#fff" &&
    backgroundColor !== "#ffffff"
      ? backgroundColor
      : "#0f172a";
  const safeAccent =
    themeColor &&
    themeColor !== "#000" &&
    themeColor !== "#000000" &&
    themeColor !== safeBg
      ? themeColor
      : "#38bdf8";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">`,
    `  <rect width="128" height="128" rx="28" fill="${safeBg}"/>`,
    `  <rect x="6" y="6" width="116" height="116" rx="23" stroke="${safeAccent}" stroke-width="4" stroke-opacity="0.65"/>`,
    `  <circle cx="64" cy="64" r="42" fill="${safeAccent}" fill-opacity="0.16" stroke="${safeAccent}" stroke-width="3"/>`,
    `  <text x="64" y="76" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="38" font-weight="800" fill="#f8fafc">${initials}</text>`,
    `</svg>`,
  ].join("\n");
}

function parseHexRgb(hex: string): [number, number, number] {
  const cleaned = (hex || "").replace(/^#/, "").trim();
  if (cleaned.length === 3) {
    return [
      parseInt(cleaned[0] + cleaned[0], 16) || 15,
      parseInt(cleaned[1] + cleaned[1], 16) || 23,
      parseInt(cleaned[2] + cleaned[2], 16) || 42,
    ];
  }
  if (cleaned.length >= 6) {
    return [
      parseInt(cleaned.slice(0, 2), 16) || 15,
      parseInt(cleaned.slice(2, 4), 16) || 23,
      parseInt(cleaned.slice(4, 6), 16) || 42,
    ];
  }
  return [15, 23, 42];
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createFallbackPngBuffer(
  size: number,
  bgHex = "#0f172a",
  fgHex = "#38bdf8",
): Buffer {
  const [br, bg, bb] = parseHexRgb(bgHex);
  const [fr, fg, fb] = parseHexRgb(fgHex);
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  const center = (size - 1) / 2;
  const outerR = size * 0.34;
  const innerR = size * 0.18;

  for (let y = 0; y < size; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const px = rowStart + 1 + x * 4;
      if (dist <= innerR || (dist >= outerR * 0.78 && dist <= outerR)) {
        raw[px] = fr;
        raw[px + 1] = fg;
        raw[px + 2] = fb;
        raw[px + 3] = 255;
      } else {
        raw[px] = br;
        raw[px + 1] = bg;
        raw[px + 2] = bb;
        raw[px + 3] = 255;
      }
    }
  }

  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idatData = deflateSync(raw);
  return Buffer.concat([
    signature,
    makePngChunk("IHDR", ihdr),
    makePngChunk("IDAT", idatData),
    makePngChunk("IEND", Buffer.alloc(0)),
  ]);
}

let cachedCanvasModule: any | undefined;
async function getCanvasModule(): Promise<any | null> {
  if (cachedCanvasModule !== undefined) {
    return cachedCanvasModule;
  }
  try {
    const pkgName = "canvas";
    cachedCanvasModule = await import(pkgName);
    return cachedCanvasModule;
  } catch {
    cachedCanvasModule = null;
    return null;
  }
}

export async function renderIconPngBuffer(
  source: { type: "svg"; svg: string } | { type: "png"; png: Buffer },
  size: number,
  backgroundColor?: string,
): Promise<Buffer> {
  const canvasMod = await getCanvasModule();
  if (canvasMod && typeof canvasMod.createCanvas === "function") {
    try {
      const canvas = canvasMod.createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, size, size);

      if (source.type === "svg") {
        const preparedSvg = prepareSvgForRasterization(
          source.svg,
          size,
          backgroundColor,
        );
        const img = await canvasMod.loadImage(Buffer.from(preparedSvg, "utf8"));
        ctx.drawImage(img, 0, 0, size, size);
      } else {
        const img = await canvasMod.loadImage(source.png);
        ctx.drawImage(img, 0, 0, size, size);
      }

      return canvas.toBuffer("image/png");
    } catch {
      // Fall through to pure-JS PNG fallback if native SVG/PNG decode fails
    }
  }

  return createFallbackPngBuffer(size, backgroundColor || "#0f172a", "#38bdf8");
}

export function encodeIcoFromPngBuffers(
  pngBuffers: Array<{ size: number; png: Buffer }>,
): Buffer {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4);

  const dirEntries = Buffer.alloc(16 * count);
  let dataOffset = 6 + 16 * count;

  for (let i = 0; i < count; i++) {
    const { size, png } = pngBuffers[i];
    const entryOffset = i * 16;
    dirEntries.writeUInt8(size >= 256 ? 0 : size, entryOffset); // Width
    dirEntries.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1); // Height
    dirEntries.writeUInt8(0, entryOffset + 2); // Color palette
    dirEntries.writeUInt8(0, entryOffset + 3); // Reserved
    dirEntries.writeUInt16LE(1, entryOffset + 4); // Color planes
    dirEntries.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
    dirEntries.writeUInt32LE(png.length, entryOffset + 8); // Image size
    dirEntries.writeUInt32LE(dataOffset, entryOffset + 12); // Image offset
    dataOffset += png.length;
  }

  return Buffer.concat([
    header,
    dirEntries,
    ...pngBuffers.map((item) => item.png),
  ]);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    const st = await stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

export interface EnsureTemplateIconSetOptions {
  targetIconsDir: string;
  searchDirs?: string[];
  config?: SiteConfig;
  forceOverwriteAll?: boolean;
}

export interface EnsureTemplateIconSetResult {
  sourceType: "svg" | "logo-slot-svg" | "png" | "monogram" | "none";
  generatedFiles: string[];
}

function isCustomNonLobsterSvg(svgText: string): boolean {
  const trimmed = svgText.trim();
  if (!trimmed.includes("<svg")) {
    return false;
  }
  if (trimmed.includes("--shadow-claw-icon-bg")) {
    return false;
  }
  return true;
}

function isShadowClawDefaultSite(config?: SiteConfig): boolean {
  if (!config) return true;
  const title = (
    config.pwa?.name ||
    config.pwa?.shortName ||
    config.branding?.titleText ||
    config.site?.title ||
    ""
  ).trim();
  const siteUrl = (config.branding?.siteUrl || "").trim();
  if (
    (!title || title === "ShadowClaw") &&
    (!siteUrl || siteUrl.includes("xt-ml.github.io/shadow-claw"))
  ) {
    return true;
  }
  return false;
}

export async function ensureTemplateIconSet(
  options: EnsureTemplateIconSetOptions,
): Promise<EnsureTemplateIconSetResult> {
  const { targetIconsDir, config, forceOverwriteAll = false } = options;
  const searchDirs = Array.from(
    new Set([targetIconsDir, ...(options.searchDirs || [])]),
  );

  await mkdir(targetIconsDir, { recursive: true });

  const bgColor =
    config?.pwa?.backgroundColor ||
    config?.site?.themeColor ||
    config?.pwa?.themeColor ||
    "#0f172a";
  const accentColor =
    config?.pwa?.themeColor || config?.site?.themeColor || "#38bdf8";

  // 1. Discover custom SVG icon source
  let svgSource: string | null = null;
  let sourceType: EnsureTemplateIconSetResult["sourceType"] = "none";

  const svgCandidateNames = ["favicon.svg", "assets/icons/favicon.svg"];
  for (const dir of searchDirs) {
    for (const rel of svgCandidateNames) {
      const candidate = path.join(dir, rel);
      if (await fileExists(candidate)) {
        try {
          const text = await readFile(candidate, "utf8");
          if (isCustomNonLobsterSvg(text)) {
            svgSource = text;
            sourceType = "svg";
            break;
          }
        } catch {}
      }
    }
    if (svgSource) break;
  }

  // 2. Try inline <svg> from config.branding.logoSlotHtml
  if (!svgSource && config?.branding?.logoSlotHtml) {
    const extracted = extractSvgFromLogoSlotHtml(config.branding.logoSlotHtml);
    if (extracted) {
      svgSource = prepareSvgForRasterization(extracted, 128, bgColor).replace(
        /\s+width="128"\s+height="128"/,
        "",
      );
      sourceType = "logo-slot-svg";
    }
  }

  // 3. Try highest-resolution custom non-lobster PNG icon
  let pngSource: { buf: Buffer; size: number } | null = null;
  if (!svgSource) {
    const pngCandidateNames = [
      "1024.png",
      "512.png",
      "192.png",
      "icon-192x192.png",
      "180.png",
      "apple-touch-icon.png",
      "152.png",
      "128.png",
      "96.png",
      "72.png",
      "feed-64x64.png",
      "48.png",
    ];
    for (const name of pngCandidateNames) {
      for (const dir of searchDirs) {
        for (const prefix of ["", "assets/icons/"]) {
          const candidate = path.join(dir, prefix, name);
          if (await fileExists(candidate)) {
            try {
              const buf = await readFile(candidate);
              if (
                buf.length > 8 &&
                buf[0] === 0x89 &&
                buf[1] === 0x50 &&
                !isDefaultShadowClawIconBuffer(buf)
              ) {
                const width = buf.readUInt32BE(16);
                pngSource = { buf, size: width };
                sourceType = "png";
                break;
              }
            } catch {}
          }
        }
        if (pngSource) break;
      }
      if (pngSource) break;
    }
  }

  // 4. Fallback to generated monogram SVG if this is a non-ShadowClaw site
  if (!svgSource && !pngSource && !isShadowClawDefaultSite(config)) {
    const title =
      config?.pwa?.shortName ||
      config?.branding?.titleText ||
      config?.site?.title ||
      config?.pwa?.name ||
      "App";
    svgSource = buildMonogramSvg(title, accentColor, bgColor);
    sourceType = "monogram";
  }

  if (!svgSource && !pngSource) {
    return { sourceType: "none", generatedFiles: [] };
  }

  const generatedFiles: string[] = [];

  // Ensure favicon.svg exists in targetIconsDir
  const targetFaviconSvgPath = path.join(targetIconsDir, "favicon.svg");
  const hasTargetSvg = await fileExists(targetFaviconSvgPath);
  let targetSvgNeedsWrite = forceOverwriteAll || !hasTargetSvg;
  if (hasTargetSvg && !targetSvgNeedsWrite) {
    try {
      const existingSvg = await readFile(targetFaviconSvgPath, "utf8");
      if (!isCustomNonLobsterSvg(existingSvg)) {
        targetSvgNeedsWrite = true;
      }
    } catch {
      targetSvgNeedsWrite = true;
    }
  }

  if (targetSvgNeedsWrite) {
    if (svgSource) {
      await writeFile(targetFaviconSvgPath, svgSource.trim() + "\n", "utf8");
      generatedFiles.push(targetFaviconSvgPath);
    } else if (pngSource) {
      const b64 = pngSource.buf.toString("base64");
      const dim = pngSource.size || 512;
      const embeddedSvg = [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}">`,
        `  <image width="${dim}" height="${dim}" href="data:image/png;base64,${b64}"/>`,
        `</svg>`,
      ].join("\n");
      await writeFile(targetFaviconSvgPath, embeddedSvg + "\n", "utf8");
      generatedFiles.push(targetFaviconSvgPath);
    }
  }

  const renderSource = svgSource
    ? ({ type: "svg", svg: svgSource } as const)
    : ({ type: "png", png: pngSource!.buf } as const);

  async function shouldWriteIconFile(filePath: string): Promise<boolean> {
    if (forceOverwriteAll) return true;
    if (!(await fileExists(filePath))) return true;
    try {
      const existing = await readFile(filePath);
      return isDefaultShadowClawIconBuffer(existing);
    } catch {
      return true;
    }
  }

  const renderedBySize = new Map<number, Buffer>();
  async function getRenderedSize(size: number): Promise<Buffer> {
    let cached = renderedBySize.get(size);
    if (!cached) {
      cached = await renderIconPngBuffer(renderSource, size, bgColor);
      renderedBySize.set(size, cached);
    }
    return cached;
  }

  for (const size of ICON_SIZES) {
    const destPath = path.join(targetIconsDir, `${size}.png`);
    if (await shouldWriteIconFile(destPath)) {
      const pngBuf = await getRenderedSize(size);
      await writeFile(destPath, pngBuf);
      generatedFiles.push(destPath);
    }
  }

  const appleTouchPath = path.join(targetIconsDir, "apple-touch-icon.png");
  if (await shouldWriteIconFile(appleTouchPath)) {
    const png180 = await getRenderedSize(180);
    await writeFile(appleTouchPath, png180);
    generatedFiles.push(appleTouchPath);
  }

  const faviconIcoPath = path.join(targetIconsDir, "favicon.ico");
  if (await shouldWriteIconFile(faviconIcoPath)) {
    const png16 = await getRenderedSize(16);
    const png32 = await getRenderedSize(32);
    const png48 = await getRenderedSize(48);
    const icoBuf = encodeIcoFromPngBuffers([
      { size: 16, png: png16 },
      { size: 32, png: png32 },
      { size: 48, png: png48 },
    ]);
    await writeFile(faviconIcoPath, icoBuf);
    generatedFiles.push(faviconIcoPath);
  }

  return { sourceType, generatedFiles };
}
