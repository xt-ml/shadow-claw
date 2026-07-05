import type { ToolDefinition } from "./types.js";

export const bash: ToolDefinition = {
  name: "bash",
  description:
    "Execute a shell command. When WebVM is available, runs in a full Alpine Linux VM (x86) " +
    "with all standard Linux commands. When WebVM is disabled or unavailable, " +
    "falls back to a lightweight JavaScript shell emulator with 83 commands: " +
    "alias, awk, base64, basename, bash, cat, cd, chmod, clear, column, comm, command, " +
    "cp, curl, cut, date, diff, dirname, du, echo, egrep, env, expand, export, expr, false, " +
    "fgrep, file, find, fold, grep, gunzip, gzip, head, help, html-to-markdown, join, " +
    "jq, ln, ls, md5sum, mkdir, mv, nl, od, paste, printenv, printf, pwd, readlink, " +
    "realpath, rev, rg, rm, rmdir, sed, seq, sh, sha1sum, sha256sum, sha384sum, " +
    "sha512sum, sleep, sort, split, stat, strings, tac, tail, tar, tee, test, timeout, " +
    "touch, tr, tree, true, unalias, uniq, wc, which, xargs, yes, zcat. " +
    "Commands NOT available in fallback mode: node, npm, npx, git, apk, python, wget." +
    "Supports pipes (|), redirects (> >>), operators (&& || ;), newlines, and # comments. " +
    "Prefer read_file/write_file for file inspection and edits — they are faster and more reliable than shell commands for that purpose.",
  input_schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The bash command to execute",
      },
      timeout: {
        type: "number",
        description:
          "Timeout in seconds (default from Settings, initially 120; max: 1800)",
      },
    },
    required: ["command"],
  },
};
