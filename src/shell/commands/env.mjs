/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function envCommand({ args, ctx, ok }) {
  let clear = false;
  /** @type {string[]} */
  const unset = [];
  /** @type {string[]} */
  const rest = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-i") {
      clear = true;

      continue;
    }

    if (arg === "-u") {
      const next = args[index + 1];
      if (next !== undefined) {
        unset.push(next);
        index += 1;
      }
      continue;
    }

    rest.push(arg);
  }

  /** @type {Record<string, string>} */
  const outEnv = clear ? {} : { ...ctx.env };

  for (const key of unset) {
    delete outEnv[key];
  }

  for (const token of rest) {
    const eq = token.indexOf("=");
    if (eq > 0) {
      outEnv[token.slice(0, eq)] = token.slice(eq + 1);
    }
  }

  return {
    result: ok(
      Object.entries(outEnv)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") + "\n",
    ),
  };
}
