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
  createCompressedUrl,
  getPendingFileParam,
  setPendingFileParam,
} from "../../../utils/url-file-param.js";
import { applyFileUrlParam } from "./apply-file-url-param.js";

describe("applyFileUrlParam", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    setPendingFileParam(null);
  });

  it("returns false when no #file= or ?file= param is present", async () => {
    const fStore = { openInMemoryFile: jest.fn() } as any;
    const handled = await applyFileUrlParam(
      null,
      fStore,
      new URL("https://example.com/"),
    );
    expect(handled).toBe(false);
    expect(fStore.openInMemoryFile).not.toHaveBeenCalled();
  });

  it("opens decoded file in fileViewerStore when no defaultViewerComponents is configured", async () => {
    const fStore = { openInMemoryFile: jest.fn() } as any;
    const urlStr = await createCompressedUrl(
      "https://example.com/",
      "# Hello World",
      { fileName: "notes.md" },
    );

    const handled = await applyFileUrlParam(null, fStore, new URL(urlStr));
    expect(handled).toBe(true);
    expect(fStore.openInMemoryFile).toHaveBeenCalledWith({
      name: "notes.md",
      content: "# Hello World",
    });
  });

  it("routes #file= to the configured custom component for the current path", async () => {
    const script = document.createElement("script");
    script.id = "shadow-claw-site-config";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      settings: {
        defaultViewerComponents: {
          "/": "shadow-claw-draw-vector-workbench",
          "/main/bitmap/": "shadow-claw-draw-bitmap-workbench",
          "/main/animation/": "shadow-claw-draw-animation-workbench",
        },
      },
    });
    document.head.appendChild(script);

    const openFileFromUrl = jest.fn();
    const bitmapEl = document.createElement(
      "shadow-claw-draw-bitmap-workbench",
    ) as any;
    bitmapEl.openFileFromUrl = openFileFromUrl;
    document.body.appendChild(bitmapEl);

    const eventListener = jest.fn();
    bitmapEl.addEventListener("shadow-claw-file-param", eventListener);

    const fStore = { openInMemoryFile: jest.fn() } as any;
    const urlStr = await createCompressedUrl(
      "https://example.com/main/bitmap/",
      '{"width":64,"height":64}',
      { fileName: "sprite.json" },
    );

    const handled = await applyFileUrlParam(null, fStore, new URL(urlStr));
    expect(handled).toBe(true);
    expect(fStore.openInMemoryFile).not.toHaveBeenCalled();
    expect(openFileFromUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "sprite.json",
        content: '{"width":64,"height":64}',
        targetComponent: "shadow-claw-draw-bitmap-workbench",
      }),
    );
    expect(eventListener).toHaveBeenCalledTimes(1);
  });

  it("stores pending file param when target custom element is not yet mounted", async () => {
    const script = document.createElement("script");
    script.id = "shadow-claw-site-config";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      settings: {
        defaultViewerComponents: {
          "/": "shadow-claw-daw-workbench",
        },
      },
    });
    document.head.appendChild(script);

    const fStore = { openInMemoryFile: jest.fn() } as any;
    const urlStr = await createCompressedUrl(
      "https://example.com/",
      '{"name":"My Song","bpm":128}',
      { fileName: "song.scdaw.json" },
    );

    const handled = await applyFileUrlParam(null, fStore, new URL(urlStr));
    expect(handled).toBe(true);
    expect(fStore.openInMemoryFile).not.toHaveBeenCalled();
    expect(getPendingFileParam()).toEqual(
      expect.objectContaining({
        name: "song.scdaw.json",
        targetComponent: "shadow-claw-daw-workbench",
      }),
    );
  });
});
