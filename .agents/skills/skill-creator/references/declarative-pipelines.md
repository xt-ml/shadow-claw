# Declarative Execution Pipelines

Declarative execution pipelines allow skills to execute deterministic sequential tool chains directly on the worker thread without scheduling a Task or making model LLM calls.

## Configuration Syntax

Pipelines are declared in `SKILL.md` frontmatter under `metadata.execution`:

```yaml
---
name: sample-pipeline
description: Run a deterministic tool chain.
user-invocable: true
metadata:
  allowed-tools: javascript show_toast
  execution:
    type: tools
    suppressToast: true
    suppressOutput: true
    tools:
      - name: javascript
        input:
          code: "Math.floor(Math.random() * 100) + 1"
      - name: show_toast
        input:
          title: "Random Number"
          message:
            $pipe: prev
---
```

## Data Piping (`$pipe`)

Inputs in tool step configurations can reference outputs from previous steps using the `$pipe` operator:

- `{ "$pipe": "prev" }` or `{ "$pipe": -1 }`: Resolves to the return output of the immediately preceding tool step.
- `{ "$pipe": 0 }`: Resolves to the return output of step index `0` (0-indexed).
- `{ "$pipe": "javascript" }`: Resolves to the return output of the last step that ran the `javascript` tool.

## Execution Suppression

- `suppressToast: true`: Suppresses step progress toasts ("Running skill tool...") during pipeline execution.
- `suppressOutput: true`: Suppresses raw tool result blocks from being rendered in the chat thread.
- Setting suppression options at the `execution` root cascades down to all steps unless explicitly overridden per tool step.
