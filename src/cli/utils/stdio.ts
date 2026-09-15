import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export interface ReadStdinOptions {
  stdin?: NodeJS.ReadableStream & { isTTY?: boolean; readableEnded?: boolean };
  force?: boolean;
}

export interface ReadInputOrStdinOptions {
  stdin?: any;
  force?: boolean;
  combine?: boolean;
}

export interface WriteOutputOptions {
  output?: string;
  quiet?: boolean;
}

/**
 * Read raw content from stdin.
 */
export async function readStdin(
  options: ReadStdinOptions = {},
): Promise<string | null> {
  const stdinStream: any = options.stdin || process.stdin;
  const isTTY =
    typeof (stdinStream as any).isTTY === "boolean"
      ? (stdinStream as any).isTTY
      : process.stdin.isTTY;

  if (isTTY && !options.force) {
    return null;
  }

  return new Promise((resolve) => {
    let data = "";
    if (typeof (stdinStream as any).setEncoding === "function") {
      (stdinStream as any).setEncoding("utf8");
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

    if ((stdinStream as any).readableEnded) {
      resolve(data.replace(/\r?\n$/, ""));
    }
  });
}

/**
 * Read input from an argument or piped stdin, combining them if both exist.
 */
export async function readInputOrStdin(
  arg: string = "",
  options: ReadInputOrStdinOptions = {},
): Promise<string> {
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
 */
export async function writeOutput(
  data: any,
  options: WriteOutputOptions = {},
): Promise<void> {
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
