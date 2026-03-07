import { deleteGroupDirectory } from "../storage/deleteGroupDirectory.mjs";
import { deleteGroupFile } from "../storage/deleteGroupFile.mjs";
import { listGroupFiles } from "../storage/listGroupFiles.mjs";
import { writeGroupFile } from "../storage/writeGroupFile.mjs";

import { escapeRegex } from "./escapeRegex.mjs";
import { parseFlags } from "./parseFlags.mjs";
import { resolvePath } from "./resolvePath.mjs";
import { runSingle } from "./runSingle.mjs";
import { safeRead } from "./safeRead.mjs";
import { SUPPORTED_COMMANDS } from "./shell.mjs";
import { testExpr } from "./testExpr.mjs";

/**
 * @typedef {import("./shell.mjs").ShellContext} ShellContext
 * @typedef {import("./shell.mjs").ShellResult} ShellResult
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Dispatch command to handler
 *
 * @param {ShadowClawDatabase} db
 * @param {string} name
 * @param {string[]} args
 * @param {ShellContext} ctx
 * @param {string} stdin
 *
 * @returns {Promise<ShellResult>}
 */
export async function dispatch(db, name, args, ctx, stdin) {
  /** @param {string} stdout */
  const ok = (stdout) => ({
    stdout,
    stderr: "",
    exitCode: 0,
  });

  /**
   * @param {string} stderr
   * @param {number} [code=1]
   */
  const fail = (stderr, code = 1) => ({
    stdout: "",
    stderr: stderr,
    exitCode: code,
  });

  switch (name) {
    // -- Output -----------------------------------------------------------
    case "echo":
      return ok(args.join(" ") + "\n");

    case "printf": {
      if (args.length === 0) {
        return ok("");
      }

      const fmt = args[0];
      const rest = args.slice(1);

      // Very simple printf: %s and %d
      let out = fmt;
      let idx = 0;

      out = out.replace(/%[sd]/g, () => rest[idx++] ?? "");
      out = out.replace(/\\n/g, "\n").replace(/\\t/g, "\t");

      return ok(out);
    }

    // -- File reading -----------------------------------------------------
    case "cat": {
      if (args.length === 0 && stdin) return ok(stdin);
      const parts = [];
      for (const f of args) {
        if (f === "-") {
          parts.push(stdin);

          continue;
        }

        const content = await safeRead(db, ctx.groupId, resolvePath(f, ctx));
        if (content === null) {
          return fail(`cat: ${f}: No such file`);
        }

        parts.push(content);
      }

      return ok(parts.join(""));
    }

    case "head": {
      const { flags, operands } = parseFlags(args, ["n"]);
      const n = parseInt(flags.n ?? "10", 10);
      const text =
        operands.length > 0
          ? ((await safeRead(db, ctx.groupId, resolvePath(operands[0], ctx))) ??
            "")
          : stdin;

      return ok(text.split("\n").slice(0, n).join("\n") + "\n");
    }

    case "tail": {
      const { flags, operands } = parseFlags(args, ["n"]);
      const n = parseInt(flags.n ?? "10", 10);
      const text =
        operands.length > 0
          ? ((await safeRead(db, ctx.groupId, resolvePath(operands[0], ctx))) ??
            "")
          : stdin;

      const lines = text.split("\n");

      return ok(lines.slice(Math.max(0, lines.length - n)).join("\n"));
    }

    // -- Text processing --------------------------------------------------
    case "wc": {
      const text =
        args.length > 0
          ? ((await safeRead(db, ctx.groupId, resolvePath(args[0], ctx))) ?? "")
          : stdin;

      const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
      const words = text.split(/\s+/).filter(Boolean).length;
      const chars = text.length;

      return ok(`${lines} ${words} ${chars}\n`);
    }

    case "grep": {
      const { flags, operands } = parseFlags(
        args,
        ["e", "m"],
        ["i", "v", "c", "n", "l"],
      );

      const pattern = flags.e ?? operands.shift() ?? "";
      const text =
        operands.length > 0
          ? ((await safeRead(db, ctx.groupId, resolvePath(operands[0], ctx))) ??
            "")
          : stdin;
      const re = new RegExp(pattern, flags.i !== undefined ? "i" : "");
      const invert = flags.v !== undefined;

      let lines = text.split("\n").filter((l) => {
        const m = re.test(l);
        return invert ? !m : m;
      });

      if (flags.m !== undefined) {
        lines = lines.slice(0, parseInt(flags.m, 10));
      }

      if (flags.c !== undefined) {
        return ok(String(lines.length) + "\n");
      }

      if (flags.n !== undefined) {
        const all = text.split("\n");
        lines = lines.map((l) => `${all.indexOf(l) + 1}:${l}`);
      }

      // grep exits 1 when no matches
      return lines.length > 0 ? ok(lines.join("\n") + "\n") : fail("", 1);
    }

    case "sort": {
      const { flags, operands } = parseFlags(args, [], ["r", "n", "u"]);
      const text =
        operands.length > 0
          ? ((await safeRead(db, ctx.groupId, resolvePath(operands[0], ctx))) ??
            "")
          : stdin;

      let lines = text.split("\n").filter(Boolean);
      if (flags.n !== undefined) {
        lines.sort((a, b) => parseFloat(a) - parseFloat(b));
      } else {
        lines.sort();
      }

      if (flags.r !== undefined) {
        lines.reverse();
      }

      if (flags.u !== undefined) {
        lines = [...new Set(lines)];
      }

      return ok(lines.join("\n") + "\n");
    }

    case "uniq": {
      const text =
        args.length > 0
          ? ((await safeRead(db, ctx.groupId, resolvePath(args[0], ctx))) ?? "")
          : stdin;

      const lines = text.split("\n");
      const result = lines.filter((l, i) => i === 0 || l !== lines[i - 1]);

      return ok(result.join("\n"));
    }

    case "tr": {
      const text = stdin;
      if (args[0] === "-d" && args[1]) {
        const chars = args[1];

        return ok(text.replace(new RegExp(`[${escapeRegex(chars)}]`, "g"), ""));
      }

      if (args.length >= 2) {
        const from = args[0];
        const to = args[1];

        let result = text;
        for (let i = 0; i < from.length; i++) {
          const replacement = i < to.length ? to[i] : to[to.length - 1];
          result = result.replace(
            new RegExp(escapeRegex(from[i]), "g"),
            replacement,
          );
        }

        return ok(result);
      }

      return fail("tr: missing operands");
    }

    case "cut": {
      const { flags, operands } = parseFlags(args, ["d", "f"]);
      const delim = flags.d ?? "\t";
      const fields = (flags.f ?? "1")
        .split(",")
        .map((s) => parseInt(s, 10) - 1);

      const text =
        operands.length > 0
          ? ((await safeRead(db, ctx.groupId, resolvePath(operands[0], ctx))) ??
            "")
          : stdin;

      const result = text.split("\n").map((line) => {
        const parts = line.split(delim);
        return fields.map((f) => parts[f] ?? "").join(delim);
      });

      return ok(result.join("\n"));
    }

    case "sed": {
      const expr = args[0] ?? "";
      const text =
        args.length > 1
          ? ((await safeRead(db, ctx.groupId, resolvePath(args[1], ctx))) ?? "")
          : stdin;

      const sedMatch = expr.match(/^s(.)(.+?)\1(.*?)\1([gi]*)$/);
      if (!sedMatch) {
        return fail(`sed: unsupported expression: ${expr}`);
      }

      const [, , pattern, replacement, sedFlags] = sedMatch;
      const re = new RegExp(
        pattern,
        sedFlags.includes("i") ? "gi" : sedFlags.includes("g") ? "g" : "",
      );

      return ok(text.replace(re, replacement));
    }

    case "awk": {
      const text =
        args.length > 1
          ? ((await safeRead(db, ctx.groupId, resolvePath(args[1], ctx))) ?? "")
          : stdin;

      const program = args[0] ?? "";
      const printMatch = program.match(/\{\s*print\s+(.*?)\s*\}/);
      if (printMatch) {
        const fieldExpr = printMatch[1];
        const lines = text.split("\n").filter(Boolean);
        const result = lines.map((line) => {
          const fields = line.split(/\s+/);
          return fieldExpr.replace(/\$(\d+)/g, (_, n) => {
            const idx = parseInt(n, 10);
            return idx === 0 ? line : (fields[idx - 1] ?? "");
          });
        });

        return ok(result.join("\n") + "\n");
      }
      return fail("awk: only basic {print $N} patterns supported");
    }

    // -- Filesystem -------------------------------------------------------
    case "ls": {
      const { flags, operands } = parseFlags(args, [], ["l", "a", "1"]);
      const dir = operands[0] || ".";
      try {
        const entries = await listGroupFiles(
          db,
          ctx.groupId,
          resolvePath(dir, ctx),
        );

        let filtered = entries;
        if (flags.a === undefined) {
          filtered = entries.filter((e) => !e.startsWith("."));
        }

        if (flags["1"] !== undefined || flags.l !== undefined) {
          return ok(filtered.join("\n") + "\n");
        }

        return ok(filtered.join("  ") + "\n");
      } catch {
        return fail(`ls: cannot access '${dir}': No such directory`);
      }
    }

    case "mkdir": {
      const { flags, operands } = parseFlags(args, [], ["p"]);
      for (const dir of operands) {
        // OPFS creates dirs implicitly on write, so just write a .keep file
        await writeGroupFile(
          db,
          ctx.groupId,
          resolvePath(dir + "/.keep", ctx),
          "",
        );
      }
      return ok("");
    }

    case "touch": {
      for (const f of args) {
        const path = resolvePath(f, ctx);
        const existing = await safeRead(db, ctx.groupId, path);
        if (existing === null) {
          await writeGroupFile(db, ctx.groupId, path, "");
        }
      }
      return ok("");
    }

    case "cp": {
      if (args.length < 2) return fail("cp: missing operands");
      const src = resolvePath(args[0], ctx);
      const dst = resolvePath(args[1], ctx);
      const content = await safeRead(db, ctx.groupId, src);
      if (content === null) return fail(`cp: ${args[0]}: No such file`);
      await writeGroupFile(db, ctx.groupId, dst, content);
      return ok("");
    }

    case "mv": {
      if (args.length < 2) return fail("mv: missing operands");
      const src = resolvePath(args[0], ctx);
      const dst = resolvePath(args[1], ctx);
      const content = await safeRead(db, ctx.groupId, src);
      if (content === null) return fail(`mv: ${args[0]}: No such file`);
      await writeGroupFile(db, ctx.groupId, dst, content);
      await deleteGroupFile(db, ctx.groupId, src);
      return ok("");
    }

    case "rm": {
      const { flags, operands } = parseFlags(args, [], ["r", "f"]);
      for (const f of operands) {
        try {
          const path = resolvePath(f, ctx);
          if (flags.r !== undefined) {
            await deleteGroupDirectory(db, ctx.groupId, path);
          } else {
            await deleteGroupFile(db, ctx.groupId, path);
          }
        } catch {
          if (flags.f === undefined) {
            return fail(`rm: ${f}: No such file or directory`);
          }
        }
      }
      return ok("");
    }

    case "pwd":
      return ok(
        (ctx.cwd === "." ? "/workspace" : `/workspace/${ctx.cwd}`) + "\n",
      );

    case "cd": {
      const target = args[0] ?? ".";
      ctx.cwd = resolvePath(target, ctx);
      ctx.env.PWD = `/workspace/${ctx.cwd}`;
      return ok("");
    }

    // -- Utilities --------------------------------------------------------
    case "date":
      return ok(new Date().toISOString() + "\n");

    case "env":
    case "printenv":
      return ok(
        Object.entries(ctx.env)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n") + "\n",
      );

    case "export": {
      for (const a of args) {
        const eq = a.indexOf("=");
        if (eq > 0) ctx.env[a.slice(0, eq)] = a.slice(eq + 1);
      }
      return ok("");
    }

    case "sleep": {
      const ms = Math.min(parseFloat(args[0] ?? "0") * 1000, 5000);
      await new Promise((r) => setTimeout(r, ms));
      return ok("");
    }

    case "seq": {
      const nums = args.map(Number);
      let start = 1,
        step = 1,
        end = 1;
      if (nums.length === 1) {
        end = nums[0];
      } else if (nums.length === 2) {
        start = nums[0];
        end = nums[1];
      } else if (nums.length >= 3) {
        start = nums[0];
        step = nums[1];
        end = nums[2];
      }
      const out = [];
      for (let i = start; step > 0 ? i <= end : i >= end; i += step)
        out.push(i);
      return ok(out.join("\n") + "\n");
    }

    case "true":
      return ok("");

    case "false":
      return fail("", 1);

    case "test":
    case "[": {
      const testArgs = name === "[" ? args.slice(0, -1) : args;
      return testExpr(db, testArgs, ctx);
    }

    case "base64": {
      const text =
        args.length > 0 && args[0] !== "-d"
          ? ((await safeRead(
              db,
              ctx.groupId,
              resolvePath(args[args.length - 1], ctx),
            )) ?? "")
          : stdin;
      if (args.includes("-d") || args.includes("--decode")) {
        return ok(atob(text.trim()));
      }
      return ok(btoa(text) + "\n");
    }

    case "md5sum":
    case "sha256sum": {
      const algo = name === "md5sum" ? "SHA-1" : "SHA-256";
      const text =
        args.length > 0
          ? ((await safeRead(db, ctx.groupId, resolvePath(args[0], ctx))) ?? "")
          : stdin;
      const data = new TextEncoder().encode(text);
      if (!crypto.subtle) {
        return fail(`${name}: crypto.subtle is not available`);
      }

      const hash = await crypto.subtle.digest(algo, data);
      const hex = Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const fname = args[0] ?? "-";

      return ok(`${hex}  ${fname}\n`);
    }

    case "tee": {
      const text = stdin;
      for (const f of args) {
        await writeGroupFile(db, ctx.groupId, resolvePath(f, ctx), text);
      }

      return ok(text);
    }

    case "basename": {
      const p = args[0] ?? "";
      const parts = p.replace(/\/$/, "").split("/");
      let base = parts[parts.length - 1] || "";

      if (args[1])
        base = base.replace(new RegExp(escapeRegex(args[1]) + "$"), "");

      return ok(base + "\n");
    }

    case "dirname": {
      const p = args[0] ?? "";
      const parts = p.split("/");
      parts.pop();

      return ok((parts.join("/") || ".") + "\n");
    }

    case "xargs": {
      if (args.length === 0) {
        return ok(stdin);
      }

      const lines = stdin.trim().split("\n").filter(Boolean);
      const cmd = args.join(" ") + " " + lines.join(" ");

      return runSingle(db, cmd, ctx);
    }

    case "rev": {
      const text =
        args.length > 0
          ? ((await safeRead(db, ctx.groupId, resolvePath(args[0], ctx))) ?? "")
          : stdin;

      return ok(
        text
          .split("\n")
          .map((l) => l.split("").reverse().join(""))
          .join("\n"),
      );
    }

    case "yes": {
      const word = args[0] ?? "y";
      return ok(Array(100).fill(word).join("\n") + "\n");
    }

    case "jq": {
      const expr = args[0] ?? ".";
      const text =
        args.length > 1
          ? ((await safeRead(db, ctx.groupId, resolvePath(args[1], ctx))) ?? "")
          : stdin;
      try {
        let obj = JSON.parse(text.trim());
        if (expr !== ".") {
          const parts = expr
            .replace(/^\.\s*/, "")
            .split(/\.|\[|\]/)
            .filter(Boolean);
          for (const p of parts) {
            if (p === "keys") {
              obj = Object.keys(obj);

              break;
            }
            if (p === "length") {
              obj = Array.isArray(obj) ? obj.length : Object.keys(obj).length;

              break;
            }

            obj = obj?.[isNaN(Number(p)) ? p : Number(p)];
          }
        }

        return ok(JSON.stringify(obj, null, 2) + "\n");
      } catch (e) {
        return fail(`jq: ${e instanceof Error ? e.message : "parse error"}`);
      }
    }

    case "which":
    case "command": {
      const target = args.filter((a) => !a.startsWith("-"))[0] ?? "";
      if (SUPPORTED_COMMANDS.has(target)) {
        return ok(`/usr/bin/${target}\n`);
      }

      return fail(`${name}: ${target}: not found`);
    }

    default:
      return fail(
        `${name}: command not found. Available: echo, cat, head, tail, grep, sort, ` +
          `sed, awk, cut, tr, uniq, wc, ls, mkdir, cp, mv, rm, touch, pwd, cd, date, ` +
          `sleep, seq, base64, jq, tee, xargs, test, rev, basename, dirname. ` +
          `For complex logic, use the "javascript" tool instead.`,
        127,
      );
  }
}
