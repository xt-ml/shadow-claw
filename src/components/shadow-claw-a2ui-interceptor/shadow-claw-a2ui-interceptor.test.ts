import { jest } from "@jest/globals";
import { ShadowClawA2UIInterceptor } from "./shadow-claw-a2ui-interceptor.js";

describe("ShadowClawA2UIInterceptor", () => {
  let interceptor: ShadowClawA2UIInterceptor;

  beforeEach(() => {
    interceptor = new ShadowClawA2UIInterceptor();
    document.body.appendChild(interceptor);
  });

  afterEach(() => {
    document.body.removeChild(interceptor);
  });

  it("registers component", () => {
    expect(customElements.get("shadow-claw-a2ui-interceptor")).toBe(
      ShadowClawA2UIInterceptor,
    );
    expect(interceptor.shadowRoot).not.toBeNull();
  });

  it("intercepts play/playTrack actions and stops propagation", () => {
    const mockA2UI = document.createElement("shadow-claw-a2ui");
    mockA2UI.attachShadow({ mode: "open" });
    const audio = document.createElement("audio");
    audio.play = jest.fn().mockResolvedValue(undefined as never) as any;
    mockA2UI.shadowRoot!.appendChild(audio);

    interceptor.appendChild(mockA2UI);

    const event = new CustomEvent("shadow-claw-a2ui-action", {
      detail: { action: { actionId: "play" } },
      bubbles: true,
      cancelable: true,
    });

    const stopSpy = jest.spyOn(event, "stopPropagation");

    interceptor.dispatchEvent(event);

    expect(audio.play).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalled();
  });

  it("intercepts pause/pauseTrack actions and stops propagation", () => {
    const mockA2UI = document.createElement("shadow-claw-a2ui");
    mockA2UI.attachShadow({ mode: "open" });
    const video = document.createElement("video");
    video.pause = jest.fn();
    mockA2UI.shadowRoot!.appendChild(video);

    interceptor.appendChild(mockA2UI);

    const event = new CustomEvent("shadow-claw-a2ui-action", {
      detail: { action: { actionId: "pauseTrack" } },
      bubbles: true,
      cancelable: true,
    });

    const stopSpy = jest.spyOn(event, "stopPropagation");

    interceptor.dispatchEvent(event);

    expect(video.pause).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalled();
  });

  it("intercepts close/closeModal actions and clicks close button", () => {
    const mockA2UI = document.createElement("shadow-claw-a2ui");
    mockA2UI.attachShadow({ mode: "open" });

    const overlay = document.createElement("div");
    overlay.className = "a2ui__modal-overlay";
    overlay.style.display = "block";

    const closeBtn = document.createElement("button");
    closeBtn.className = "a2ui__modal-close";
    closeBtn.click = jest.fn();

    overlay.appendChild(closeBtn);
    mockA2UI.shadowRoot!.appendChild(overlay);

    interceptor.appendChild(mockA2UI);

    const event = new CustomEvent("shadow-claw-a2ui-action", {
      detail: { action: { actionId: "closeModal" } },
      bubbles: true,
      cancelable: true,
    });

    const stopSpy = jest.spyOn(event, "stopPropagation");

    interceptor.dispatchEvent(event);

    expect(closeBtn.click).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalled();
  });

  it("ignores unhandled actions", () => {
    const event = new CustomEvent("shadow-claw-a2ui-action", {
      detail: { action: { actionId: "unknownAction" } },
      bubbles: true,
      cancelable: true,
    });

    const stopSpy = jest.spyOn(event, "stopPropagation");
    interceptor.dispatchEvent(event);

    expect(stopSpy).not.toHaveBeenCalled();
  });

  it("handles missing actionId or action detail", () => {
    const event = new CustomEvent("shadow-claw-a2ui-action", {
      detail: null as any,
      bubbles: true,
      cancelable: true,
    });
    const stopSpy = jest.spyOn(event, "stopPropagation");
    interceptor.dispatchEvent(event);
    expect(stopSpy).not.toHaveBeenCalled();

    const emptyEvent = new CustomEvent("shadow-claw-a2ui-action", {
      detail: { action: {} } as any,
    });
    interceptor.dispatchEvent(emptyEvent);
  });

  it("handles play and pause alternate actionIds and media rejection", async () => {
    const mockA2UI = document.createElement("shadow-claw-a2ui");
    mockA2UI.attachShadow({ mode: "open" });
    const audio = document.createElement("audio");
    const playReject = Promise.reject(new Error("Playback blocked"));
    audio.play = jest.fn().mockReturnValue(playReject) as any;
    audio.pause = jest.fn();
    mockA2UI.shadowRoot!.appendChild(audio);
    interceptor.appendChild(mockA2UI);

    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // playTrack
    const playTrackEvent = new CustomEvent("shadow-claw-a2ui-action", {
      detail: { action: { actionId: "playTrack" } },
      bubbles: true,
    });
    interceptor.dispatchEvent(playTrackEvent);
    expect(audio.play).toHaveBeenCalled();
    await Promise.resolve();
    expect(consoleSpy).toHaveBeenCalled();

    // pause
    const pauseEvent = new CustomEvent("shadow-claw-a2ui-action", {
      detail: { action: { actionId: "pause" } },
      bubbles: true,
    });
    interceptor.dispatchEvent(pauseEvent);
    expect(audio.pause).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("handles close alternate actionId and hidden overlays or missing close button", () => {
    const mockA2UI = document.createElement("shadow-claw-a2ui");
    mockA2UI.attachShadow({ mode: "open" });

    // Hidden overlay
    const hiddenOverlay = document.createElement("div");
    hiddenOverlay.className = "a2ui__modal-overlay";
    hiddenOverlay.style.display = "none";

    // Visible overlay without close button
    const noBtnOverlay = document.createElement("div");
    noBtnOverlay.className = "a2ui__modal-overlay";
    noBtnOverlay.style.display = "flex";

    mockA2UI.shadowRoot!.append(hiddenOverlay, noBtnOverlay);
    interceptor.appendChild(mockA2UI);

    const closeEvent = new CustomEvent("shadow-claw-a2ui-action", {
      detail: { action: { actionId: "close" } },
      bubbles: true,
    });
    const stopSpy = jest.spyOn(closeEvent, "stopPropagation");
    interceptor.dispatchEvent(closeEvent);
    expect(stopSpy).toHaveBeenCalled();
  });

  it("handles when a2ui child is missing or has no media/overlays", () => {
    // No shadow-claw-a2ui element in interceptor
    const event = new CustomEvent("shadow-claw-a2ui-action", {
      detail: { action: { actionId: "play" } },
      bubbles: true,
    });
    const stopSpy = jest.spyOn(event, "stopPropagation");
    interceptor.dispatchEvent(event);
    expect(stopSpy).not.toHaveBeenCalled();

    const pauseEvt = new CustomEvent("shadow-claw-a2ui-action", {
      detail: { action: { actionId: "pause" } },
      bubbles: true,
    });
    interceptor.dispatchEvent(pauseEvt);

    const closeEvt = new CustomEvent("shadow-claw-a2ui-action", {
      detail: { action: { actionId: "close" } },
      bubbles: true,
    });
    interceptor.dispatchEvent(closeEvt);
  });

  it("cleans up listener on disconnectedCallback", () => {
    interceptor.disconnectedCallback();

    const event = new CustomEvent("shadow-claw-a2ui-action", {
      detail: { action: { actionId: "play" } },
    });
    interceptor.dispatchEvent(event);
  });
});
