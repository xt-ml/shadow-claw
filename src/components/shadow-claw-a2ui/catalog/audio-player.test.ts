import { jest } from "@jest/globals";
import { renderAudioPlayer } from "./audio-player.js";
import type { AudioPlayerSpec } from "../../../ui/a2ui.js";

describe("renderAudioPlayer", () => {
  it("renders an audio element with resolved URL", () => {
    const spec: AudioPlayerSpec = {
      id: "test-audio",
      component: "AudioPlayer",
      url: "https://example.com/audio.mp3",
    };

    const ctx = {
      resolveMediaUrl: jest
        .fn()
        .mockReturnValue("https://example.com/audio.mp3") as any,
    };

    const el = renderAudioPlayer(spec, { dataModel: {} } as any, ctx);

    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("a2ui__audio");

    const audioEl = el.querySelector("audio");
    expect(audioEl).not.toBeNull();
    expect(audioEl?.src).toBe("https://example.com/audio.mp3");
    expect(audioEl?.controls).toBe(true);
  });

  it("handles workspace file URLs correctly", () => {
    const spec: AudioPlayerSpec = {
      id: "test-audio",
      component: "AudioPlayer",
      url: "/files/workspace/audio.wav",
    };

    const ctx = {
      resolveMediaUrl: jest
        .fn()
        .mockReturnValue("/files/workspace/audio.wav") as any,
    };

    const el = renderAudioPlayer(spec, { dataModel: {} } as any, ctx);
    const audioEl = el.querySelector("audio");
    expect(audioEl?.getAttribute("data-a2ui-workspace-src")).toBe(
      "/files/workspace/audio.wav",
    );
    expect(audioEl?.src).toBe("");
  });

  it("renders description if provided", () => {
    const spec: AudioPlayerSpec = {
      id: "test-audio",
      component: "AudioPlayer",
      url: "https://example.com/audio.mp3",
      description: "A cool audio clip",
    };

    const ctx = {
      resolveMediaUrl: jest
        .fn()
        .mockReturnValue("https://example.com/audio.mp3") as any,
    };

    const el = renderAudioPlayer(spec, { dataModel: {} } as any, ctx);
    const descEl = el.querySelector(".a2ui__audio-description");
    expect(descEl).not.toBeNull();
    expect(descEl?.textContent).toBe("A cool audio clip");
  });
});
