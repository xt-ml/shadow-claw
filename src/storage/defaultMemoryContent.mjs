// Shared source of truth for the default MEMORY.md content.
// Imported by both src/storage/ensureMainGroupMemory.ts (runtime)
// and bin/prerender-dsd-shell/prerender-dsd-shell.mjs (build-time) so they stay in sync.

export const DEFAULT_MAIN_GROUP_MEMORY_CONTENT = `---
title: "Agent Memory"
created: "1970-01-01T00:00:00Z"
updated: "1970-01-01T00:00:00Z"
slug: "agent-memory"
---

## Memory

### Workspace Layout & Skills Conventions

- **Skills**: \`.agents/skills/main/<skill-name>/SKILL.md\`
- **Declarative Tools**: \`.agents/tools/main/<tool-name>.json\`
- **Skill Format**: Markdown file with YAML frontmatter AND a Markdown body (frontmatter is metadata only; always include a \`# <Skill Title>\` heading and human-readable description in the Markdown body so it renders in document previews):

  \`\`\`yaml
  ---
  name: <skill-name>
  description: <clear summary for model and slash command>
  user-invocable: true
  metadata:
    allowed-tools: <tool1> <tool2>
    execution:
      type: tools
      tools:
        - name: <tool1>
          input: { ... }
        - name: <tool2>
          input: { "$pipe": "prev" }
  ---
  # <Skill Title>

  <Overview and description of what the skill does, parameters, and usage instructions.>
  \`\`\`

- **Declarative Tool Format**: JSON with \`"name"\`, \`"description"\`, \`"executor": "javascript"\`, \`"inputSchema"\`, and \`"code"\`.
- **Authoring**: Use \`create_directory\` before writing new directories, then \`write_file\`.`;
