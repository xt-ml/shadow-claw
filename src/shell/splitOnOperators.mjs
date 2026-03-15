/**
 * Split command by operators
 *
 * @param {string} line
 *
 * @returns {Array<{cmd: string; op: string}>}
 */
export function splitOnOperators(line) {
  const segments = [];
  let current = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let subshellDepth = 0;

  while (i < line.length) {
    const ch = line[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      i++;

      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      i++;

      continue;
    }

    if (!inSingle) {
      if (ch === "$" && line[i + 1] === "(") {
        subshellDepth++;
        current += "$(";
        i += 2;

        continue;
      }

      if (ch === "(") {
        subshellDepth++;
      }

      if (ch === ")") {
        if (subshellDepth > 0) subshellDepth--;
      }
    }

    if (inSingle || inDouble || subshellDepth > 0) {
      current += ch;
      i++;

      continue;
    }

    if (ch === "&" && line[i + 1] === "&") {
      segments.push({ cmd: current, op: "&&" });
      current = "";
      i += 2;

      continue;
    }

    if (ch === "|" && line[i + 1] === "|") {
      segments.push({ cmd: current, op: "||" });
      current = "";
      i += 2;

      continue;
    }

    if (ch === ";") {
      segments.push({ cmd: current, op: ";" });
      current = "";
      i++;

      continue;
    }

    current += ch;
    i++;
  }

  if (current.trim()) segments.push({ cmd: current, op: "" });
  return segments;
}
