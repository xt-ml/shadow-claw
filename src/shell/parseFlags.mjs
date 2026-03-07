/**
 * Parse flags from args: -n 10 or -v
 *
 * @param {string[]} args
 * @param {string[]} [withValue=[]]
 * @param {string[]} [booleans=[]]
 *
 * @returns {{ flags: Record<string, string>; operands: string[] }}
 */
export function parseFlags(args, withValue = [], booleans = []) {
  /** @type {Record<string, string>} */
  const flags = {};
  const operands = [];
  let i = 0;

  while (i < args.length) {
    const a = args[i];
    if (a === "--") {
      operands.push(...args.slice(i + 1));

      break;
    }

    if (a.startsWith("-") && a.length > 1 && !a.startsWith("--")) {
      const flag = a.slice(1);

      // Handle combined flags like -rn
      if (flag.length > 1 && !withValue.includes(flag)) {
        for (const ch of flag) {
          if (withValue.includes(ch) && i + 1 < args.length) {
            flags[ch] = args[++i];
          } else {
            flags[ch] = "";
          }
        }

        i++;

        continue;
      }

      if (withValue.includes(flag) && i + 1 < args.length) {
        flags[flag] = args[++i];
      } else {
        flags[flag] = "";
      }
    } else if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        flags[a.slice(2)] = "";
      }
    } else {
      operands.push(a);
    }

    i++;
  }

  return { flags, operands };
}
