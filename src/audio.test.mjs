import { jest } from "@jest/globals";

const originalAudioContext = globalThis.window?.AudioContext;
const originalWebkitAudioContext = globalThis.window?.webkitAudioContext;

function createMockAudioContext(state = "running") {
  return {
    state,
    currentTime: 10,
    destination: {},
    resume: jest.fn().mockResolvedValue(undefined),
    createOscillator: jest.fn(() => ({
      type: "",
      frequency: { value: 0 },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    })),
    createGain: jest.fn(() => ({
      gain: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
      },
      connect: jest.fn(),
    })),
  };
}

describe("audio", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    if (originalAudioContext) {
      window.AudioContext = originalAudioContext;
    }
    if (originalWebkitAudioContext) {
      window.webkitAudioContext = originalWebkitAudioContext;
    }
  });

  it("creates and memoizes AudioContext", async () => {
    const ctx = createMockAudioContext();
    const CtxCtor = jest.fn(() => ctx);
    window.AudioContext = CtxCtor;

    const { getAudioContext } = await import("./audio.mjs");
    const a = getAudioContext();
    const b = getAudioContext();

    expect(a).toBe(ctx);
    expect(b).toBe(ctx);
    expect(CtxCtor).toHaveBeenCalledTimes(1);
  });

  it("resumes context when suspended", async () => {
    const ctx = createMockAudioContext("suspended");
    window.AudioContext = jest.fn(() => ctx);

    const { resumeAudioContext } = await import("./audio.mjs");
    resumeAudioContext();

    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it("plays two oscillators for notification chime", async () => {
    const ctx = createMockAudioContext("running");
    window.AudioContext = jest.fn(() => ctx);

    const { playNotificationChime } = await import("./audio.mjs");
    playNotificationChime();

    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    expect(ctx.createGain).toHaveBeenCalledTimes(2);
  });
});
