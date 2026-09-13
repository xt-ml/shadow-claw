import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * Read raw content from stdin.
 * @param {{ stdin?: NodeJS.ReadableStream & { isTTY?: boolean, readableEnded?: boolean }, force?: boolean }} [options]
 * @returns {Promise<string | null>}
 */
export async function readStdin(options = {}) {
  const stdinStream = options.stdin || process.stdin;
  const isTTY =
    typeof stdinStream.isTTY === "boolean"
      ? stdinStream.isTTY
      : process.stdin.isTTY;

  if (isTTY && !options.force) {
    return null;
  }

  return new Promise((resolve) => {
    let data = "";
    if (typeof stdinStream.setEncoding === "function") {
      stdinStream.setEncoding("utf8");
    }
    stdinStream.on("data", (chunk) => {
      data += chunk;
    });
    stdinStream.on("end", () => {
      resolve(data.replace(/\r?\n$/, ""));
    });
    stdinStream.on("error", () => {
      resolve(null);
    });

    if (stdinStream.readableEnded) {
      resolve(data.replace(/\r?\n$/, ""));
    }
  });
}

/**
 * Read input from an argument or piped stdin, combining them if both exist.
 * @param {string} [arg]
 * @param {{ stdin?: any, force?: boolean, combine?: boolean }} [options]
 * @returns {Promise<string>}
 */
export async function readInputOrStdin(arg = "", options = {}) {
  const trimmedArg = String(arg || "").trim();
  const isHyphen = trimmedArg === "-";

  const piped = await readStdin({
    stdin: options.stdin,
    force: isHyphen || options.force,
  });

  if (isHyphen) {
    return piped || "";
  }

  if (!trimmedArg) {
    return piped || "";
  }

  if (piped && options.combine !== false) {
    return `${trimmedArg}\n\n${piped}`;
  }

  return trimmedArg;
}

/**
 * Write CLI output to a destination file or stdout.
 * @param {any} data
 * @param {{ output?: string, quiet?: boolean }} [options]
 */
export async function writeOutput(data, options = {}) {
  const formatted =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);

  if (options.output) {
    const outputPath = path.resolve(options.output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      formatted.endsWith("\n") ? formatted : formatted + "\n",
      "utf8",
    );
    return;
  }

  if (!options.quiet) {
    if (typeof data === "string") {
      console.log(data);
    } else {
      console.log(formatted);
    }
  }
}
