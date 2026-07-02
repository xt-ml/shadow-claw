# Guide: Adding a Tool

> Step-by-step: add a new capability to the ShadowClaw agent's tool set.

## Where Tools Live

```text
src/tools/
├── bash.ts          bash execution
├── chat.ts          clear_chat
├── fetch.ts         fetch_url
├── files.ts         read_file, write_file, patch_file, list_files, open_file
├── git.ts           git_clone, git_status, etc.
├── index.ts         ← TOOL_DEFINITIONS array (assemble here)
├── javascript.ts    sandboxed JS eval
├── memory.ts        update_memory
├── notifications.ts show_toast, send_notification
├── tasks.ts         create_task, list_tasks, etc.
└── types.ts         ToolDefinition interface
```

## Step 1 — Write the test first (TDD)

Create `src/worker/executeTool.test.ts` (or add to the existing one) with a test for your new tool:

```ts
describe("my_tool", () => {
  it("returns the expected result", async () => {
    const result = await executeTool(
      db,
      "my_tool",
      { message: "hello" },
      "br:main",
      {},
    );
    expect(result).toBe("hello from my_tool!");
  });
});
```

Run it and confirm it fails:

```bash
npm test -- --testPathPattern executeTool
```

## Step 2 — Create the tool definition file

Create `src/tools/my-tool.ts`:

```ts
import type { ToolDefinition } from "./types.js";

export const my_tool: ToolDefinition = {
  name: "my_tool",
  description: `
    Brief description of what the tool does and when the agent should use it.
    Be specific — this is the only context the LLM has for choosing this tool.
  `.trim(),
  input_schema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "The input message to process.",
      },
    },
    required: ["message"],
  },
};
```

## Step 3 — Register the tool

Open `src/tools/index.ts` and add the import + export:

```ts
import { my_tool } from "./my-tool.js";

// Add to the TOOL_DEFINITIONS array (keep it alphabetically sorted):
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // ... existing tools ...
  my_tool,
  // ...
];
```

## Step 4 — Implement the executor

Open `src/worker/executeTool.ts` and add a case to the `switch` statement:

```ts
case "my_tool": {
  const { message } = input as { message: string };
  return `hello from my_tool! You said: ${message}`;
}
```

For async operations:

```ts
case "my_tool": {
  const { message } = input as { message: string };
  const result = await doSomethingAsync(message);
  return result;
}
```

### Accessing the storage layer

The `db` and group context are available:

```ts
case "my_tool": {
  const { path } = input as { path: string };
  const content = await readGroupFile(db, groupId, path);
  await writeGroupFile(db, groupId, path, content.toUpperCase());
  return `Uppercased ${path}`;
}
```

### Posting UI events

```ts
case "my_tool": {
  // Show a toast notification
  post({ type: "show-toast", message: "Doing the thing...", toastType: "info" });

  // Open a file in the viewer
  post({ type: "open-file", groupId, path: "/workspace/result.txt" });

  return "Done!";
}
```

### Recursion guard (for tools that shouldn't run in scheduled tasks)

```ts
case "my_tool": {
  if (options.isScheduledTask) {
    return "Error: my_tool cannot be used in scheduled tasks.";
  }
  // ...
}
```

## Step 5 — Run the tests

```bash
npm test -- --testPathPattern executeTool
```

The test you wrote in Step 1 should pass now.

## Step 6 — Type-check

```bash
npm run tsc
```

Fix any TypeScript errors before opening a PR.

## Tips

- **Description quality matters.** The LLM reads the description to decide when and how to call the tool. Mention:
  - What the tool does
  - When to use it vs. alternatives
  - Any important constraints (e.g., "only works in workspace directory")
- **Input validation:** Destructure and validate inputs early; return clear error strings for bad inputs.
- **`read_file` supports batch reads** via a `paths` array — model this pattern for tools that often need multiple inputs.
- **Lazy imports for heavy dependencies:** If your tool depends on a large library, use `await import()` inside the case block.
- **Update the system prompt** (`src/orchestrator.ts` → `buildSystemPrompt`) if the tool needs explicit agent guidance (e.g., preferred usage patterns or when NOT to use it).
