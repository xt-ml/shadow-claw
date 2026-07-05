import { jest } from "@jest/globals";

const originalAudioContext = (globalThis.window as any)?.AudioContext;

const originalWebkitAudioContext = (globalThis.window as any)
  ?.webkitAudioContext;

function createMockAudioContext(state = "running") {
  return {
    state,
    currentTime: 10,
    destination: {},

    resume: (jest.fn() as any).mockResolvedValue(undefined),
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
      (window as any).AudioContext = originalAudioContext;
    }

    if (originalWebkitAudioContext) {
      (window as any).webkitAudioContext = originalWebkitAudioContext;
    }
  });

  it("creates AudioContext lazily on first access", async () => {
    const ctx = createMockAudioContext();
    const CtxCtor = jest.fn(() => ctx);

    (window as any).AudioContext = CtxCtor;

    const { getAudioContext } = await import("./audio.js");

    expect(CtxCtor).not.toHaveBeenCalled();

    const a = getAudioContext();
    const b = getAudioContext();

    expect(a).toBe(ctx);
    expect(b).toBe(ctx);
    expect(CtxCtor).toHaveBeenCalledTimes(1);
  });

  it("plays two oscillators for notification chime", async () => {
    const ctx = createMockAudioContext("running");

    (window as any).AudioContext = jest.fn(() => ctx);

    const { playNotificationChime, resumeAudioContext } =
      await import("./audio.js");

    resumeAudioContext();
    playNotificationChime();

    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    expect(ctx.createGain).toHaveBeenCalledTimes(2);
  });

  it("does not create or play audio before user unlock", async () => {
    const ctx = createMockAudioContext("running");
    const CtxCtor = jest.fn(() => ctx);

    (window as any).AudioContext = CtxCtor;

    const { playNotificationChime } = await import("./audio.js");

    playNotificationChime();

    expect(CtxCtor).not.toHaveBeenCalled();
    expect(ctx.createOscillator).not.toHaveBeenCalled();
    expect(ctx.createGain).not.toHaveBeenCalled();
  });

  it("resumeAudioContext resumes an already-existing suspended context", async () => {
    const ctx = createMockAudioContext("suspended");

    (window as any).AudioContext = jest.fn(() => ctx);

    const { getAudioContext, resumeAudioContext } = await import("./audio.js");

    const a = getAudioContext();
    expect(a.state).toBe("suspended");

    // Now resumeAudioContext should resume the existing context
    resumeAudioContext();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });
});
