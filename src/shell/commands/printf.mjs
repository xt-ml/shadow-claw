/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/**
 * @param {string} value
 *
 * @returns {{ text: string; stop: boolean }}
 */
function decodeEscapes(value) {
  let out = "";

  for (let index = 0; index < value.length; index += 1) {
    const ch = value[index];
    if (ch !== "\\") {
      out += ch;

      continue;
    }

    if (index + 1 >= value.length) {
      out += "\\";

      break;
    }

    const next = value[++index];
    if (next === "n") out += "\n";
    else if (next === "t") out += "\t";
    else if (next === "v") out += "\v";
    else if (next === "r") out += "\r";
    else if (next === "f") out += "\f";
    else if (next === "e") out += "\x1b";
    else if (next === "b") out += "\b";
    else if (next === "a") out += "\x07";
    else if (next === "c") return { text: out, stop: true };
    else if (next === "x") {
      let hex = "";

      while (
        index + 1 < value.length &&
        /[0-9a-f]/iu.test(value[index + 1]) &&
        hex.length < 2
      ) {
        hex += value[++index];
      }

      if (hex.length === 0) {
        out += "x";
      } else {
        out += String.fromCharCode(Number.parseInt(hex, 16));
      }
    } else if (/[0-7]/u.test(next)) {
      let oct = next;

      while (
        index + 1 < value.length &&
        /[0-7]/u.test(value[index + 1]) &&
        oct.length < 3
      ) {
        oct += value[++index];
      }
      out += String.fromCharCode(Number.parseInt(oct, 8));
    } else {
      out += next;
    }
  }

  return { text: out, stop: false };
}

/** @type {ShellCommandHandler} */
export async function printfCommand({ args, ok }) {
  if (args.length === 0) {
    return { result: ok("") };
  }

  const fmt = args[0] ?? "";
  const argv = args.slice(1);
  let out = "";
  let idx = 0;

  for (let index = 0; index < fmt.length; index += 1) {
    const ch = fmt[index];
    if (ch === "%" && index + 1 < fmt.length) {
      const spec = fmt[index + 1];
      if (spec === "%") {
        out += "%";
        index += 1;

        continue;
      }

      const value = argv[idx++] ?? "";
      if (spec === "s") {
        out += value;
        index += 1;

        continue;
      }

      if (spec === "d") {
        const parsed = Number.parseInt(value, 0);
        out += Number.isNaN(parsed) ? "0" : String(parsed);
        index += 1;

        continue;
      }

      if (spec === "b") {
        const decoded = decodeEscapes(value);
        out += decoded.text;
        if (decoded.stop) {
          return { result: ok(out) };
        }

        index += 1;

        continue;
      }
    }

    out += ch;
  }

  const decodedFmt = decodeEscapes(out);
  out = decodedFmt.text;

  return { result: ok(out) };
}
