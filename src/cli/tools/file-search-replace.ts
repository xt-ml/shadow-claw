import { getProjectRoot } from "../utils/resolve-project-root.js";
import { argv, chdir, exit, stdin } from "node:process";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dataProjectRoot = getProjectRoot(import.meta.url);

/**
 * Reads UTF-8 content from process stdin.
 */
export async function readStdin(input: any = stdin): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of input) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8").trim();
}

export interface FileSearchReplaceOptions {
  readFileImpl?: (path: string, encoding: "utf8") => Promise<string>;
  writeFileImpl?: (
    path: string,
    content: string,
    encoding: "utf8",
  ) => Promise<any>;
  stdin?: any;
  logImpl?: (...args: any[]) => void;
}

export async function fileSearchReplace(
  args: string[],
  {
    readFileImpl = readFile,
    writeFileImpl = writeFile,
    stdin: stdinImpl = stdin,
    logImpl = console.log,
  }: FileSearchReplaceOptions = {},
): Promise<void> {
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

export async function main(): Promise<void> {
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

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    exit(1);
  });
}
