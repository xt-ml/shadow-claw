import { writeGroupFile } from "../../storage/writeGroupFile.mjs";
import { safeRead } from "../safeRead.mjs";
import { resolvePath } from "../resolvePath.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/**
 * @typedef {{ name: string; content: string | null }} TarEntry
 * @typedef {{ shadowclawTar: true; entries: TarEntry[] }} TarArchive
 */

/**
 * Parse tar arguments, handling both combined ("cf", "tf", "xf") and
 * separate ("-c -f") flag styles.
 *
 * @param {string[]} args
 *
 * @returns {{ mode: string; archiveFile: string; targets: string[] } | { error: string }}
 */
function parseTarArgs(args) {
  if (args.length === 0) {
    return { error: "tar: must specify one of -c, -t, -x" };
  }

  let mode = "";
  let archiveFile = "";
  /** @type {string[]} */
  const targets = [];

  // Check for combined shorthand: cf/tf/xf/czf/tzf/xzf (with optional leading -)
  const first = args[0].replace(/^-+/, "");
  const combinedMatch = first.match(/^([ctx])[a-z]*f$/iu);
  if (combinedMatch) {
    mode = combinedMatch[1].toLowerCase();
    if (args.length < 2) {
      return { error: "tar: option requires an argument -- 'f'" };
    }
    archiveFile = args[1];
    targets.push(...args.slice(2));
    return { mode, archiveFile, targets };
  }

  // Parse separated flags
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    const stripped = token.replace(/^-+/, "");

    if (stripped === "c" || token === "-c") {
      mode = "c";
    } else if (stripped === "t" || token === "-t") {
      mode = "t";
    } else if (stripped === "x" || token === "-x") {
      mode = "x";
    } else if (token === "-f" || stripped === "f") {
      archiveFile = args[++i] ?? "";
    } else if (token.startsWith("-")) {
      // absorb flags like -z, -v, -k, etc.
    } else {
      targets.push(token);
    }
  }

  if (!mode) {
    return { error: "tar: must specify one of -c, -t, -x" };
  }

  if (!archiveFile) {
    return { error: "tar: must specify -f archivename" };
  }

  return { mode, archiveFile, targets };
}

/** @type {ShellCommandHandler} */
export async function tarCommand({ db, args, ctx, ok, fail }) {
  const parsed = parseTarArgs(args);
  if ("error" in parsed) {
    return { result: fail(parsed.error, 2) };
  }

  const { mode, archiveFile, targets } = parsed;
  const archivePath = resolvePath(archiveFile, ctx);

  if (mode === "c") {
    /** @type {TarEntry[]} */
    const entries = [];

    for (const target of targets) {
      const filePath = resolvePath(target, ctx);
      const content = await safeRead(db, ctx.groupId, filePath);
      entries.push({ name: target, content: content ?? "" });
    }

    /** @type {TarArchive} */
    const archive = { shadowclawTar: true, entries };
    await writeGroupFile(db, ctx.groupId, archivePath, JSON.stringify(archive));
    return { result: ok("") };
  }

  if (mode === "t" || mode === "x") {
    const raw = await safeRead(db, ctx.groupId, archivePath);
    if (raw === null) {
      return {
        result: fail(`tar: ${archiveFile}: No such file or directory`, 2),
      };
    }

    /** @type {TarArchive} */
    let archive;
    try {
      archive = JSON.parse(raw);
      if (!archive.shadowclawTar || !Array.isArray(archive.entries)) {
        throw new Error("invalid format");
      }
    } catch {
      return { result: fail(`tar: ${archiveFile}: not a valid archive`, 2) };
    }

    if (mode === "t") {
      const listing = archive.entries.map((e) => e.name).join("\n") + "\n";
      return { result: ok(listing) };
    }

    // mode === "x"
    const filter = new Set(targets);
    for (const entry of archive.entries) {
      if (filter.size > 0 && !filter.has(entry.name)) {
        continue;
      }

      if (entry.content !== null) {
        await writeGroupFile(
          db,
          ctx.groupId,
          resolvePath(entry.name, ctx),
          entry.content,
        );
      }
    }
    return { result: ok("") };
  }

  return { result: fail(`tar: unknown mode '${mode}'`, 2) };
}
