#!/usr/bin/env node

import { argv, chdir, exit, stdin } from "node:process";
import { dirname, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataProjectRoot = join(__dirname, "..");

/**
 * Reads UTF-8 content from process stdin.
 *
 * @returns {Promise<string>}
 */
export async function readStdin(input = stdin) {
  const chunks = [];

  for await (const chunk of input) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8").trim();
}

export async function fileSearchReplace(
  args,
  {
    readFileImpl = readFile,
    writeFileImpl = writeFile,
    stdin: stdinImpl = stdin,
    logImpl = console.log,
  } = {},
) {
  if (args.length < 2) {
    throw new Error("at least a search pattern and file path are required");
  }

  const [searchPatternStr, filePath, prepend = "", maybeReplacement] = args;
  const searchPattern = new RegExp(searchPatternStr, "g");
  const replacement = maybeReplacement ?? (await readStdin(stdinImpl));

  let content = await readFileImpl(filePath, "utf8");

  content = content.replace(searchPattern, `${prepend}${replacement}`);

  await writeFileImpl(filePath, content, "utf8");

  logImpl(`Replaced content in: ${filePath}`);
}

export async function main() {
  const args = argv.slice(2);
  chdir(dataProjectRoot);

  if (args.length < 2) {
    console.error(
      "Usage: node file-search-replace <searchPattern> <filePath> [prepend] [replacement]",
    );

    console.error(
      "If replacement omitted, reads replacement string from stdin pipe.",
    );

    exit(1);
  }

  await fileSearchReplace(args);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    exit(1);
  });
}
