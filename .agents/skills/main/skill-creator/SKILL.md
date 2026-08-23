---
name: skill-creator
description: Create, edit, review, and validate ShadowClaw declarative skills and their supporting resources.
user-invocable: true
metadata:
  allowed-tools: read_file write_file javascript create_directory
---

# ShadowClaw Skill Creator

Use this skill when creating, modifying, reviewing, or validating a ShadowClaw agent skill or declarative tool pipeline.

## Workspace Layout Standards

- **Skills**: Create each skill in its dedicated directory under `.agents/skills/<group>/<skill-name>/SKILL.md` (default group: `main`).
- **Declarative Tools**: Define supporting declarative tools under `.agents/tools/<group>/<tool-name>.json` (default group: `main`).
- **Supporting Resources**: Co-locate skill-specific assets (reference documents, templates, helper scripts) inside the skill directory alongside `SKILL.md`.

## Workflow

1. **Establish Contract & Scope**
   - For existing skills, read `SKILL.md` and related resources before editing.
   - For new skills, define the trigger prompt, intended execution outcome, required tools, and output artifacts.
2. **Configure Frontmatter**
   - Provide a clear, concise trigger description in `description` (1024 characters max).
   - Set `user-invocable: true` if the skill should be triggerable via slash command (e.g. `/skill-name`).
   - Use `disable-model-invocation: true` for skills intended strictly for slash-command execution.
   - Place non-standard configuration (such as `allowed-tools`) within the standard `metadata` block to maintain Agent Skills specification compliance.
3. **Structure & Draft Content**
   - Write instructions in `SKILL.md` using clear, modular procedures.
   - Place deterministic operations in `javascript` tool calls; use `read_file` and `write_file` for workspace persistence.
   - Create required target directories via `create_directory` prior to writing files.
4. **Declarative Pipelines (`execution.type: tools`)**
   - Define sequential tool pipelines in frontmatter via `execution: { type: "tools", tools: [...] }`.
   - Pass outputs between steps using `{ "$pipe": "prev" }` or step/tool identifiers.
   - Optionally apply `suppressToast: true` or `suppressOutput: true` at the execution root or per step to suppress notifications and output blocks.
5. **Verify & Validate**
   - Re-read the saved `SKILL.md` and verify valid YAML frontmatter syntax.
   - Ensure the skill name uses 1–64 lowercase alphanumeric characters or hyphens and all referenced resource paths exist.
