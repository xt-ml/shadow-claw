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
});
