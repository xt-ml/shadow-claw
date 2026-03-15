/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function dirnameCommand({ args, ok }) {
  /** @param {string} path */
  const dirnameOf = (path) => {
    if (!path) {
      return ".";
    }

    if (/^\/+$/u.test(path)) {
      return "/";
    }

    const trimmed = path.replace(/\/+$/u, "");
    if (!trimmed) {
      return "/";
    }

    const slashIndex = trimmed.lastIndexOf("/");
    if (slashIndex < 0) {
      return ".";
    }

    let dir = trimmed.slice(0, slashIndex).replace(/\/+$/u, "");
    if (!dir) {
      return "/";
    }

    if (/^\/+$/u.test(dir)) {
      return "/";
    }

    return dir;
  };

  const paths = args.length > 0 ? args : [""];
  const output = paths.map(dirnameOf).join("\n") + "\n";

  return { result: ok(output) };
}
