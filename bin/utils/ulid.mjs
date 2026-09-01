/**
 * ShadowClaw CLI — ULID generator (no dependencies)
 * Generates ULIDs (Universally Unique Lexicographically Sortable Identifiers).
 */

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

let lastTime = 0;
let lastRandom = [];

/**
 * Generate a ULID
 */
export function ulid() {
  const now = Date.now();

  if (now === lastTime) {
    for (let i = lastRandom.length - 1; i >= 0; i--) {
      if (lastRandom[i] < ENCODING_LEN - 1) {
        lastRandom[i]++;
        break;
      }
      lastRandom[i] = 0;
    }
  } else {
    lastTime = now;
    lastRandom = Array.from(
      crypto.getRandomValues(new Uint8Array(RANDOM_LEN)),
      (b) => b % ENCODING_LEN,
    );
  }

  let time = now;
  const timeChars = new Array(TIME_LEN);
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    timeChars[i] = ENCODING[time % ENCODING_LEN];
    time = Math.floor(time / ENCODING_LEN);
  }

  const randomChars = lastRandom.map((r) => ENCODING[r]);
  return timeChars.join("") + randomChars.join("");
}
