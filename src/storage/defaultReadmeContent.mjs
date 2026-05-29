// Shared source of truth for the default MEMORY.md content.
// Imported by both src/storage/ensureMainGroupReadme.ts (runtime)
// and bin/prerender-dsd-shell.mjs (build-time) so they stay in sync.

export const DEFAULT_MAIN_GROUP_README_CONTENT = `# Welcome to ShadowClaw Pages

This is the default static page for your workspace.

## Getting Started with ShadowClaw

## What is MEMORY.md?

- MEMORY.md is a per conversation, per invocation, auto-loaded, persistent agent memory file.
- It is designed to be a helpful scratchpad for agents to store important information, notes, and context about the conversation.

## How to Use Pages

- Open \`Files\` to browse your workspace.
- Use Set as Page on any markdown or HTML file to add it to Pages.
- Remove a page anytime from the \`Pages\` view.

## How to Use Chat
- Open \`Settings\` to configure your agent's system prompt, tools, and more.
- Open \`Chat\` to start a conversation with your agent.
`;
