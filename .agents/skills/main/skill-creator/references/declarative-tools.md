# Declarative Tools

Declarative tools allow workspace authors to define reusable custom tools using JSON definitions placed under `.agents/tools/<group>/<tool-name>.json`.

## Directory Structure

```text
.agents/tools/
└── main/
    └── generate_random_number.json
```

## Schema Format

```json
{
  "name": "generate_random_number",
  "description": "Generate a random integer within a specified range.",
  "executor": "javascript",
  "inputSchema": {
    "type": "object",
    "properties": {
      "min": { "type": "number", "default": 1 },
      "max": { "type": "number", "default": 1000000 }
    }
  },
  "code": "const min = Number(inputs.min ?? 1); const max = Number(inputs.max ?? 1000000); return Math.floor(Math.random() * (max - min + 1)) + min;"
}
```

## Features

- **Automatic Discovery**: Automatically loaded from `.agents/tools/` across conversation workspaces.
- **WebMCP Integration**: Registered with the browser ModelContext API for both manual pinning and automated agent execution.
- **Expression Evaluation**: Code expressions automatically evaluate and return results without needing explicit wrapper boilerplate.
