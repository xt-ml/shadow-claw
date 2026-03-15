/**
 * Tokenize a command line respecting quotes
 *
 * @param {string} cmd
 *
 * @returns {string[]}
 */
export function tokenize(cmd) {
  const tokens = [];

  let current = "";
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  for (const ch of cmd) {
    if (escape) {
      current += ch;
      escape = false;

      continue;
    }

    if (ch === "\\" && !inSingle) {
      escape = true;

      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;

      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;

      continue;
    }

    if (ch === " " && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current);
      }

      current = "";

      continue;
    }

    current += ch;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}
