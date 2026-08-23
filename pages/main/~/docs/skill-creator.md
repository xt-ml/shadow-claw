---
title: "Agent Skills & Skill Creator"
created: "1970-01-01T00:00:00Z"
updated: "1970-01-01T00:00:00Z"
slug: "skill-creator"
---

## Agent Skills & Skill Creator

Welcome to the ShadowClaw Agent Skills guide! Skills are workspace-local instruction packages and automated tool pipelines that give your AI assistant specialized capabilities.

Whether you want to teach the assistant a specialized coding workflow, build silent background utility tools, or trigger automated tasks with slash commands, **Agent Skills** make it simple and declarative.

---

## 🌟 Quick Start: What is an Agent Skill?

An Agent Skill is a directory containing a `SKILL.md` file located inside your workspace's `.agents/skills/` folder:

```text
.agents/skills/
└── main/
    ├── skill-creator/
    │   ├── SKILL.md
    │   └── references/
    │       ├── frontmatter-spec.md
    │       ├── declarative-pipelines.md
    │       └── declarative-tools.md
    └── toast-random-number/
        └── SKILL.md
```

Each skill includes:

1. **`SKILL.md`**: Standard frontmatter metadata (name, description, slash command triggers) and step-by-step instructions.
2. **`references/` Directory**: Detailed reference guides and technical documentation co-located with the skill.
3. **Declarative Pipelines**: Optional deterministic tool workflows (`execution.type: "tools"`) that execute instantly without calling LLM prompts.

---

## 🚀 Creating Skills with `/skill-creator`

ShadowClaw comes with an official bundled **Skill Creator**. You can trigger it anytime by typing `/skill-creator` in the chat thread or asking the AI assistant to create a skill for you.

### Recommended Skill Authoring Workflow

1. **Define the Scope & Trigger**: Decide on a clear skill name (e.g. `toast-random-number`) and write a concise description of what it does.
2. **Set Up Workspace Folders**:
   - Skill files belong in `.agents/skills/main/<skill-name>/SKILL.md`.
   - Custom declarative tools belong in `.agents/tools/main/<tool-name>.json`.
3. **Write `SKILL.md`**: Configure standard frontmatter attributes and instructions.
4. **Add Technical References**: Store detailed reference materials under the skill's `references/` directory.

---

## 📚 Skill Reference Documentation

For deep technical details, explore the co-located reference guides bundled with the official `skill-creator` skill:

- 📋 **[Frontmatter Specification](file:///.agents/skills/main/skill-creator/references/frontmatter-spec.md)**  
  Complete schema rules for `name`, `description`, `user-invocable`, `disable-model-invocation`, `argument-hint`, and `metadata.allowed-tools`.

- ⚡ **[Declarative Execution Pipelines](file:///.agents/skills/main/skill-creator/references/declarative-pipelines.md)**  
  How to write zero-LLM tool chains using `execution.type: "tools"`, `$pipe` output piping, `suppressToast`, and `suppressOutput`.

- 🛠️ **[Declarative Tools Reference](file:///.agents/skills/main/skill-creator/references/declarative-tools.md)**  
  How to author custom JSON tool definitions in `.agents/tools/` with sandboxed JavaScript evaluation and WebMCP model context integration.

---

## 💡 Example: A Two-Step Declarative Skill

Here is a complete, real-world example of a declarative skill that generates a random number and displays it in a toast notification silently:

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
# Toast Random Number

This skill generates a random integer and displays it instantly in a toast notification.
```

When you type `/toast-random-number`, ShadowClaw executes the two steps directly without delay!
