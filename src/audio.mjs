/** @type {AudioContext|null} */
let audioCtx = null;

/**
 * Get or create the shared AudioContext
 * @returns {AudioContext}
 */
export function getAudioContext() {
  if (!audioCtx) {
    // @ts-ignore
    audioCtx = new (window.AudioContext || window["webkitAudioContext"])();
  }

  return audioCtx;
}

/**
 * Resume AudioContext on user gesture
 */
export function resumeAudioContext() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    ctx.resume().catch((err) => {
      console.warn("Failed to resume AudioContext:", err);
    });
  }
}

/**
 * Play notification chime
 */
export function playNotificationChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // If context is suspended, try to resume it one more time
    // though it should have been resumed by user gesture already
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    // Two-tone chime: C5 → E5
    const frequencies = [523.25, 659.25];
    for (let i = 0; i < frequencies.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = frequencies[i];

      gain.gain.setValueAtTime(0.3, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.4);
    }
  } catch (err) {
    console.warn("Audio chime failed:", err);
  }
}
