import { jest } from "@jest/globals";
import {
  CompressionStream as NodeCompressionStream,
  DecompressionStream as NodeDecompressionStream,
  ReadableStream as NodeReadableStream,
} from "node:stream/web";

if (typeof globalThis.CompressionStream === "undefined") {
  (globalThis as any).CompressionStream = NodeCompressionStream;
}
if (typeof globalThis.DecompressionStream === "undefined") {
  (globalThis as any).DecompressionStream = NodeDecompressionStream;
}
if (typeof globalThis.ReadableStream === "undefined") {
  (globalThis as any).ReadableStream = NodeReadableStream;
}

import {
  MAX_HASH_URL_LENGTH,
  MAX_QUERY_URL_LENGTH,
  MAX_URL_PAYLOAD_CHARS,
  base64UrlToBytes,
  bytesToBase64Url,
  clearUrlParam,
  compressToBase64Url,
  consumePendingFileParam,
  createCompressedUrl,
  decompressFromBase64Url,
  getBaseHref,
  getCompressedParam,
  getSiteConfigDefaultViewerComponents,
  getUrlParam,
  inferSharedFileName,
  readFileParamFromUrl,
  resolveDefaultViewerComponent,
  setPendingFileParam,
  validateBase64UrlLength,
  validateCompressedUrl,
} from "./url-file-param.js";

describe("url-file-param utilities", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    setPendingFileParam(null);
  });

  describe("base64url & length validation", () => {
    it("round-trips bytes through bytesToBase64Url and base64UrlToBytes", () => {
      const input = new Uint8Array([0, 1, 2, 250, 251, 255, 62, 63]);
      const encoded = bytesToBase64Url(input);
      expect(encoded).not.toMatch(/[+/=]/);
      expect(base64UrlToBytes(encoded)).toEqual(input);
    });

    it("validates Base64URL length and alphabet", () => {
      expect(validateBase64UrlLength("").valid).toBe(false);
      expect(validateBase64UrlLength("bad+char/=").valid).toBe(false);
      expect(validateBase64UrlLength("abc_123-XYZ").valid).toBe(true);
      expect(
        validateBase64UrlLength("a".repeat(MAX_URL_PAYLOAD_CHARS + 1)).valid,
      ).toBe(false);
    });

    it("validates constructed URL lengths for hash vs query", () => {
      const shortHash = "https://example.com/#file=abc";
      expect(validateCompressedUrl(shortHash).maxLength).toBe(
        MAX_HASH_URL_LENGTH,
      );
      expect(validateCompressedUrl(shortHash).valid).toBe(true);

      const longQuery =
        "https://example.com/?file=" + "a".repeat(MAX_QUERY_URL_LENGTH + 1);
      expect(validateCompressedUrl(longQuery).valid).toBe(false);
    });
  });

  describe("compression & URL param round-trip", () => {
    it("compresses and decompresses UTF-8 text via deflate-raw", async () => {
      const text = JSON.stringify({
        name: "Test Song",
        bpm: 120,
        emoji: "🎵",
      });
      const compressed = await compressToBase64Url(text);
      const decompressed = await decompressFromBase64Url(compressed);
      expect(decompressed).toBe(text);
    });

    it("creates and reads #file= and companion #name= params", async () => {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>';
      const shareUrl = await createCompressedUrl(
        "https://xt-ml.github.io/shadow-claw-draw/",
        svg,
        { fileName: "icon.svg" },
      );

      expect(shareUrl).toContain("#file=");
      expect(shareUrl).toContain("name=icon.svg");
      expect(getUrlParam("name", shareUrl)).toBe("icon.svg");

      const decoded = await getCompressedParam("file", shareUrl);
      expect(decoded).toBe(svg);

      const parsed = await readFileParamFromUrl(shareUrl);
      expect(parsed).not.toBeNull();
      expect(parsed?.content).toBe(svg);
      expect(parsed?.name).toBe("icon.svg");
    });

    it("infers .json for valid JSON and .txt otherwise when name is omitted", async () => {
      const jsonUrl = await createCompressedUrl(
        "https://example.com/",
        '{"hello":"world"}',
      );
      const jsonParsed = await readFileParamFromUrl(jsonUrl);
      expect(jsonParsed?.name).toBe("shared-file.json");

      const txtUrl = await createCompressedUrl(
        "https://example.com/",
        "plain text note",
      );
      const txtParsed = await readFileParamFromUrl(txtUrl);
      expect(txtParsed?.name).toBe("shared-file.txt");

      expect(inferSharedFileName("{}", "custom.scdaw.json")).toBe(
        "custom.scdaw.json",
      );
    });

    it("clears both query and hash parameters without clobbering other params", () => {
      const replaceSpy = jest
        .spyOn(window.history, "replaceState")
        .mockImplementation(() => {});

      const updated = clearUrlParam(
        "file",
        "https://example.com/main/?foo=1&file=abc#file=abc&autoplay=true",
      );
      expect(updated).toBe("https://example.com/main/?foo=1#autoplay=true");
      expect(replaceSpy).toHaveBeenCalled();

      replaceSpy.mockRestore();
    });

    it("resolves base href cleanly", () => {
      const base = document.createElement("base");
      base.setAttribute("href", "https://xt-ml.github.io/shadow-claw-draw/");
      document.head.appendChild(base);
      expect(getBaseHref(document, window.location)).toBe(
        "https://xt-ml.github.io/shadow-claw-draw/",
      );
    });
  });

  describe("defaultViewerComponents resolution", () => {
    const drawMap = {
      "/": "shadow-claw-draw-vector-workbench",
      "/main/bitmap/": "shadow-claw-draw-bitmap-workbench",
      "/main/animation/": "shadow-claw-draw-animation-workbench",
    };

    it("resolves string defaultViewerComponents directly", () => {
      expect(
        resolveDefaultViewerComponent(
          "/anything/",
          "shadow-claw-daw-workbench",
        ),
      ).toBe("shadow-claw-daw-workbench");
    });

    it("resolves path-to-component map with basePath stripping and longest prefix match", () => {
      expect(
        resolveDefaultViewerComponent(
          "/shadow-claw-draw/",
          drawMap,
          "/shadow-claw-draw/",
        ),
      ).toBe("shadow-claw-draw-vector-workbench");

      expect(
        resolveDefaultViewerComponent(
          "/shadow-claw-draw/main/bitmap/",
          drawMap,
          "/shadow-claw-draw/",
        ),
      ).toBe("shadow-claw-draw-bitmap-workbench");

      expect(
        resolveDefaultViewerComponent(
          "/shadow-claw-draw/main/animation",
          drawMap,
          "/shadow-claw-draw/",
        ),
      ).toBe("shadow-claw-draw-animation-workbench");
    });

    it("returns null when no defaultViewerComponents is configured", () => {
      expect(resolveDefaultViewerComponent("/", null)).toBeNull();
      expect(getSiteConfigDefaultViewerComponents()).toBeNull();
    });

    it("reads settings.defaultViewerComponents from #shadow-claw-site-config", () => {
      const script = document.createElement("script");
      script.id = "shadow-claw-site-config";
      script.type = "application/json";
      script.textContent = JSON.stringify({
        settings: {
          defaultViewerComponents: drawMap,
        },
      });
      document.head.appendChild(script);

      expect(getSiteConfigDefaultViewerComponents()).toEqual(drawMap);
    });

    it("stores and consumes pending file param for a target component", () => {
      setPendingFileParam({
        content: '{"a":1}',
        name: "song.scdaw.json",
        rawParam: "abc",
        targetComponent: "shadow-claw-daw-workbench",
        url: "https://example.com/#file=abc",
      });

      expect(consumePendingFileParam("other-component")).toBeNull();
      const consumed = consumePendingFileParam("shadow-claw-daw-workbench");
      expect(consumed?.name).toBe("song.scdaw.json");
      expect(consumePendingFileParam("shadow-claw-daw-workbench")).toBeNull();
    });
  });
});
