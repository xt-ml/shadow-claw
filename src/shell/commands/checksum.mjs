import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */
/** @typedef {import("../../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase */
/** @typedef {{ name: string, text: string }} ChecksumSource */

const MD5_ROTATIONS = Object.freeze([
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
  9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
  16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15,
  21,
]);

const MD5_CONSTANTS = Object.freeze(
  Array.from(
    { length: 64 },
    (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0,
  ),
);

/**
 * @param {number} word
 * @param {number} shift
 *
 * @returns {number}
 */
function rotateLeft(word, shift) {
  return ((word << shift) | (word >>> (32 - shift))) >>> 0;
}

/**
 * @param {BufferSource} buffer
 *
 * @returns {string}
 */
function toHex(buffer) {
  const bytes = ArrayBuffer.isView(buffer)
    ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    : new Uint8Array(buffer);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * @param {string} text
 *
 * @returns {string}
 */
function md5Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const wordCount = (((bytes.length + 8) >> 6) + 1) * 16;
  const words = new Uint32Array(wordCount);

  for (let index = 0; index < bytes.length; index += 1) {
    words[index >> 2] |= bytes[index] << ((index % 4) * 8);
  }

  words[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8);

  const bitLength = bytes.length * 8;
  words[wordCount - 2] = bitLength >>> 0;
  words[wordCount - 1] = Math.floor(bitLength / 0x100000000) >>> 0;

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < words.length; offset += 16) {
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let round = 0; round < 64; round += 1) {
      let f;
      let g;

      if (round < 16) {
        f = (b & c) | (~b & d);
        g = round;
      } else if (round < 32) {
        f = (d & b) | (~d & c);
        g = (5 * round + 1) % 16;
      } else if (round < 48) {
        f = b ^ c ^ d;
        g = (3 * round + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * round) % 16;
      }

      const nextD = d;
      d = c;
      c = b;

      const sum = (a + f + MD5_CONSTANTS[round] + words[offset + g]) >>> 0;
      b = (b + rotateLeft(sum, MD5_ROTATIONS[round])) >>> 0;
      a = nextD;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  return [a0, b0, c0, d0]
    .map((word) =>
      Array.from({ length: 4 }, (_, index) =>
        ((word >>> (index * 8)) & 0xff).toString(16).padStart(2, "0"),
      ).join(""),
    )
    .join("");
}

/**
 * @param {"MD5" | "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512"} algorithm
 * @param {string} text
 *
 * @returns {Promise<string>}
 */
async function digestHex(algorithm, text) {
  if (algorithm === "MD5") {
    return md5Hex(text);
  }

  const hash = await crypto.subtle.digest(
    algorithm,
    new TextEncoder().encode(text),
  );

  return toHex(hash);
}

/**
 * @param {ShadowClawDatabase} db
 * @param {readonly string[]} args
 * @param {import("../shell.mjs").ShellContext} ctx
 * @param {string} stdin
 *
 * @returns {Promise<{ sources: ChecksumSource[] } | { missing: string }>}
 */
async function readSources(db, args, ctx, stdin) {
  const operands = args.length > 0 ? args : ["-"];
  /** @type {ChecksumSource[]} */
  const sources = [];

  for (const operand of operands) {
    if (operand === "-") {
      sources.push({ name: "-", text: stdin });

      continue;
    }

    const text = await safeRead(db, ctx.groupId, resolvePath(operand, ctx));
    if (text === null) {
      return { missing: operand };
    }

    sources.push({ name: operand, text });
  }

  return { sources };
}

/**
 * @param {string} commandName
 * @param {"MD5" | "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512"} algorithm
 *
 * @returns {ShellCommandHandler}
 */
export function createChecksumCommand(commandName, algorithm) {
  return async function checksumCommand({ db, args, ctx, stdin, ok, fail }) {
    if (algorithm !== "MD5" && !crypto?.subtle) {
      return {
        result: fail(`${commandName}: crypto.subtle is not available`),
      };
    }

    const readResult = await readSources(db, args, ctx, stdin);
    if ("missing" in readResult) {
      return {
        result: fail(
          `${commandName}: ${readResult.missing}: No such file or directory`,
        ),
      };
    }

    const { sources } = readResult;

    const lines = [];
    for (const source of sources) {
      const hex = await digestHex(algorithm, source.text);
      lines.push(`${hex}  ${source.name}`);
    }

    return { result: ok(`${lines.join("\n")}\n`) };
  };
}
