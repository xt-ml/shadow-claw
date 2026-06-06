// Shared source of truth for the default MEMORY.md content.
// Imported by both src/storage/ensureMainGroupMemory.ts (runtime)
// and bin/prerender-dsd-shell.mjs (build-time) so they stay in sync.

export const DEFAULT_MAIN_GROUP_MEMORY_CONTENT = `# Welcome to ShadowClaw Pages

This is the default static page for your workspace.

## Getting started with ShadowClaw

### What is MEMORY.md?

- "[MEMORY.md](/files/br-main/MEMORY.md)" is a per conversation, per invocation, auto-loaded, persistent agent memory file.
- It is designed to be a helpful scratchpad for agents to store important information, notes, and context about the conversation.

### How to use Files

- Open "[Files](/files/br-main)" to browse your workspace.
- Edit and preview files with the file viewer: [index.html](/files/br-main/index.html)

### How to use Pages

- Use Set as Page on any markdown or HTML file to add it to Pages.
- Remove a page anytime from the "[Pages](/pages)" view.

### How to use Chat

- Open "[Settings](/settings)" to configure your agent's system prompt, tools, and more.
- Open "[Chat](/chat/br-main)" to start a conversation with your agent.

## Further information

- [ShadowClaw Project](https://github.com/xt-ml/shadow-claw#-shadowclaw)
- [Deep Wiki](https://deepwiki.com/xt-ml/shadow-claw)
`;
