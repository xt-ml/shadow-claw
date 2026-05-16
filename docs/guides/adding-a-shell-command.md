# Guide: Adding a Shell Command

> The just-bash emulator provides 100+ built-in commands, but here's how to
> understand the surface and fill gaps if needed.

## How the Shell Works

The shell emulator (`src/shell/shell.ts`) uses `just-bash` — a JavaScript library
that implements a POSIX-like shell with a real AST parser. Commands are pure
JavaScript implementations that write to an in-memory virtual filesystem.

ShadowClaw wraps `just-bash` with a `ShadowClawFileSystem` bridge (`src/shell/fs.ts`)
that syncs changes back to persistent OPFS storage.

Directory creation through `mkdir` is also persisted through this bridge via
`createGroupDirectory()`, so folders created from the JS shell appear immediately
in the Files page.

## What Already Exists

Before adding anything, check the `just-bash` built-ins:

| Category | Commands                                                                                                                                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File ops | `cat`, `cp`, `ls`, `mkdir`, `mv`, `rm`, `rmdir`, `touch`, `tree`, `basename`, `dirname`, `stat`, `chmod`, `du`, `pwd`                                                                                                        |
| Text     | `awk`, `column`, `comm`, `cut`, `diff`, `expand`, `fold`, `grep`/`egrep`/`fgrep`, `head`, `join`, `md5sum`, `nl`, `od`, `paste`, `printf`, `rev`, `rg`, `sed`, `sort`, `strings`, `tac`, `tail`, `tr`, `uniq`, `wc`, `xargs` |
| Data     | `jq`, `sqlite3`, `yq`, `js-exec`                                                                                                                                                                                             |
| Sys      | `echo`, `printf`, `env`, `export`, `cd`, `exit`, `true`, `false`, `test`, `[`, `[[`                                                                                                                                          |

Most operations are already covered. The `javascript` tool (`src/tools/javascript.ts`)
is almost always a better choice than adding a shell built-in.

## Adding a New Built-in (upstream contribution or fork)

`just-bash` is an npm package. Adding built-in commands requires one of:

1. **Opening a PR to just-bash upstream** (preferred)
2. **Forking just-bash** and patching `package.json` to use your fork
3. **Wrapping via `js-exec`** — calling custom JS code from a shell command

### Option 3: Using js-exec

`js-exec` is a built-in that evaluates JS inside the shell:

```bash
result=$(js-exec "return require('some-module').doThing()")
echo $result
```

This is the fastest path for one-off custom behavior.

## Adding a Workspace Helper Script

You can add helper scripts to the group's workspace that the agent can then call:

1. Use `write_file` to create `bin/my-helper.sh`
2. Add a tip in the system prompt (`buildSystemPrompt`) about the helper's existence

## Fallback to javascript Tool

For complex operations that exceed shell capabilities, the `javascript` tool is the right choice:

```js
// Agent calls: javascript({ code: "..." })
// Code runs in a sandboxed strict-mode environment:
const fs = require("fs"); // OPFS backed
const result = processData(/* ... */);
return JSON.stringify(result);
```

The sandbox in `src/worker/sandboxedEval.ts` restricts:

- No `eval`
- No `new Function`
- No DOM access
- No network requests (use `fetch_url` tool instead)

## When Should the Agent Use bash vs javascript?

The system prompt (`src/orchestrator.ts`) advises:

- `bash` → file navigation, grep, sed, quick one-liners
- `javascript` → computation, data transformation, anything requiring logic
- `read_file` + `write_file` → reading/writing files (faster than bash, supports batch)
- `git_*` → git operations (never bash for git commands)
