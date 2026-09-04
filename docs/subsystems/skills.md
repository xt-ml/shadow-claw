# Agent Skills

> Workspace-local instruction packages that give the agent specialized guidance, declarative tool pipelines, and bundled resources.

## Layout

Skills are discovered recursively beneath `.agents/skills/` in each conversation workspace. A skill is a directory containing `SKILL.md`:

```text
.agents/skills/
└── main/
    ├── skill-creator/
    │   └── SKILL.md
    └── toast-random-number/
        └── SKILL.md
```

`SKILL.md` uses YAML frontmatter. The required fields are `name` and `description`. Optional fields defined by the standard specification are `license`, `compatibility`, `metadata`, `user-invocable`, `disable-model-invocation`, and `argument-hint`. Custom parameters such as `allowed-tools` and `execution` belong inside `metadata`.

Skill names must be 1-64 characters containing lowercase letters, digits, and single hyphens. Descriptions must be 1,024 characters or fewer.

## Discovery and activation

`discoverSkills()` loads skill metadata without loading the full instruction body into the prompt. Discovery scans `.agents/skills/` within the requested conversation group workspace, falling back to `DEFAULT_GROUP_ID` so non-default rooms inherit main group skills. The model receives the names and descriptions of skills that do not set `disable-model-invocation: true`. When a task matches a description, the model calls `activate_skill` with the exact skill name.

Activation returns the skill instructions, its directory path, and a sorted list of bundled resource paths loaded from the skill's originating workspace group (`groupId`). Relative paths in the instructions resolve against that skill directory. Scripts must run through the workspace `bash` or `javascript` tools, and repository changes must use the workspace Git tools; skills never receive host filesystem access.

Malformed skills and duplicate names are skipped and reported as discovery diagnostics. Discovery stops after visiting 2,000 directories. A skill can be refreshed by activating it again, so the returned body and resources reflect the current workspace files.

## Slash Commands & User Invocability

Skills with `user-invocable: true` (or where `user-invocable` is not explicitly set to `false`) can be triggered by users in chat using slash commands matching their skill name (e.g. `/toast-random-number` or `/skill-creator`).

When a slash command is executed:

1. `parseSkillCommand()` matches the message against available skills.
2. If the skill contains a `metadata.execution: { type: "tools", tools: [...] }` block, the orchestrator dispatches `execute-skill-tools` directly to the worker thread. The worker executes the tool chain via `executeToolChain` without scheduling a Task or calling model LLM prompts.
3. If the skill does not contain an explicit `execution` block, the orchestrator enqueues a prompt message `[SKILL COMMAND] Activate the "<name>" skill...` to invoke the standard LLM agent loop.

## Declarative Execution Pipelines & Suppression

Skills can define deterministic sequential tool execution pipelines in frontmatter via `metadata.execution`:

```yaml
---
name: toast-random-number
description: Generate a random integer from 1 to 1000000 and show it in a ShadowClaw toast notification.
user-invocable: true
metadata:
  allowed-tools: javascript show_toast generate_random_number
  execution:
    type: tools
    suppressToast: true
    suppressOutput: true
    tools:
      - name: javascript
        input:
          code: Math.floor(Math.random() * 1000000) + 1
      - name: show_toast
        input:
          title: Random Number
          message:
            $pipe: prev
---
```

### Features:

- **Output Pipelining (`$pipe`)**: Inputs can reference previous tool outputs using `{ "$pipe": "prev" }`, `{ "$pipe": <step_index> }`, or `{ "$pipe": "<tool_name>" }`.
- **Toast & Output Suppression**:
  - `suppressToast: true` suppresses intermediate step toast notifications ("Running skill tool...").
  - `suppressOutput: true` suppresses raw tool step output blocks from rendering into the chat thread.
  - Setting suppression flags at the top-level `execution` block automatically cascades down to all steps in the tool chain unless explicitly overridden per step.

## Default Bundled Skills

ShadowClaw includes standard default skills under `.agents/skills/main/`:

- **`skill-creator`**: Guide for creating, editing, reviewing, and validating declarative skills and supporting resources. (Example skills such as **`toast-random-number`** are included in the `shadow-claw-template` repository).

## Agent Skills Discovery Index (RFC v0.2.0)

ShadowClaw implements the **Agent Skills Discovery RFC (v0.2.0)** (`https://schemas.agentskills.io/discovery/0.2.0/schema.json`), generating a standardized machine-readable discovery index at `/.well-known/agent-skills/index.json`.

### Features:

- **Manifest Parsing:** Parses YAML frontmatter across `.agents/skills/**/SKILL.md` to extract skill names, descriptions, compatibility, and execution tool/script configurations.
- **Dependency Tracking:** Links skills to their referenced declarative tools (`.agents/tools/main/*.json`) and companion scripts (`.agents/scripts/main/*`).
- **Cryptographic Verification:** Calculates SHA-256 digests (`sha256:<hex>`) for all indexed skills, tools, and scripts to enable tamper detection and caching.
- **RFC 3986 Relative URLs:** Emits standardized relative URLs (e.g. `../../.agents/skills/main/...`) relative to the `.well-known/agent-skills/index.json` location.

### CLI Generator:

The index can be generated or refreshed on demand via the CLI:

```bash
npx shadow-claw skills:index [dir]
# Alias:
npx shadow-claw agent-skills [dir]
```

Options include `--out-dir <dir>`, `--out-file <file>`, `--stdout`, and `--no-write`.

### Build Pipeline Integration:

During `shadow-claw build` (`bin/build/build.mjs`), the build runner automatically invokes `generateSkillsIndex(contentRoot)` when `.agents/skills` is present. It writes the index to `<contentRoot>/.well-known/agent-skills/index.json`, copies `.agents/scripts` into `dist/public/.agents/scripts`, and publishes `.well-known` directly into `dist/public/.well-known`.

## Static publishing

For content-only sites, files under `.agents/skills/main/` are copied into the build manifest and seeded into the Main conversation's workspace. They are not copied into other conversation workspaces. A skills purge marker can clear the previously seeded `.agents/skills/main/` directory before the current published skills are seeded; see the template README for the marker format.

## Source locations

- `src/subsystems/skills/parseSkill.ts` — frontmatter parsing, validation, and suppression cascading
- `src/subsystems/skills/parseSkillCommand.ts` — slash command parsing and skill resolution
- `src/subsystems/skills/discoverSkills.ts` — workspace discovery and resource listing
- `src/subsystems/skills/activateSkill.ts` — model activation response
- `src/subsystems/skills/tool.ts` — `activate_skill` tool definition
- `src/core/orchestrator/utils/enqueue.ts` — slash command detection and execution dispatching
- `src/worker/utils/toolChain.ts` — shared `executeToolChain` and `$pipe` resolution engine
- `src/worker/utils/handleMessage.ts` — `execute-skill-tools` worker message handler
- `bin/commands/skills-index.mjs` — Agent Skills Discovery index generator and CLI command
- `bin/commands/skills-index.test.mjs` — Jest test suite for discovery index generation
- `bin/build/build.mjs` — static build pipeline integration and asset synchronization
