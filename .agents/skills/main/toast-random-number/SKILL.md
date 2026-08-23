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
            $pipe: "prev"
---

# Toast Random Number

When this skill is invoked, run this exact two-step workflow:

1. Call `generate_random_number` (or `javascript`) to generate one random integer from 1 through 1000000, inclusive.

2. Call `show_toast` with the generated number as the toast message.

Do not use a Task for this example. The model's sequential tool calls are the chain: the generated number is available in the next tool call via `$pipe: "prev"`. Confirm briefly after the toast succeeds.

## Declarative Tools & Skills

This skill works alongside the declarative tool defined in `.agents/tools/main/generate_random_number.json`:

- **Declarative Tool (`generate_random_number`)**: Located at `.agents/tools/main/generate_random_number.json`. Accepts optional `min` and `max` parameters and evaluates a sandboxed JavaScript expression to return a random integer within range.
- **Declarative Skill (`/toast-random-number`)**: Located at `.agents/skills/main/toast-random-number/SKILL.md`. Demonstrates a declarative two-step pipeline that pipes tool output into `show_toast`.
