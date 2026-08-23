# Frontmatter Specification

Agent skills in ShadowClaw are configured via YAML frontmatter at the top of `SKILL.md`. Frontmatter attributes adhere strictly to the standard Agent Skills specification.

## Specification Schema

```yaml
---
name: skill-name
description: Clear, concise model-facing trigger description.
user-invocable: true
disable-model-invocation: false
argument-hint: "[arguments]"
metadata:
  allowed-tools: read_file write_file javascript
compatibility: ShadowClaw
license: MIT
---
```

## Attribute Reference

| Attribute                  | Type      | Required | Description                                                                                               |
| :------------------------- | :-------- | :------- | :-------------------------------------------------------------------------------------------------------- |
| `name`                     | `string`  | **Yes**  | Skill identifier (1–64 lowercase alphanumeric characters and single hyphens).                             |
| `description`              | `string`  | **Yes**  | Model-facing description used for skill discovery and activation (max 1024 characters).                   |
| `user-invocable`           | `boolean` | No       | When `true` (default), allows users to invoke the skill directly via slash commands (e.g. `/skill-name`). |
| `disable-model-invocation` | `boolean` | No       | When `true`, hides the skill from model discovery so it is only triggered via slash command.              |
| `argument-hint`            | `string`  | No       | Display placeholder in the UI search/autocomplete menu when typing slash commands.                        |
| `metadata`                 | `object`  | No       | Key-value dictionary for custom metadata, tool permissions (`allowed-tools`), and `execution` pipelines.  |
| `compatibility`            | `string`  | No       | Platform compatibility requirements or version strings.                                                   |
| `license`                  | `string`  | No       | Open-source software license string (e.g. `MIT`, `AGPL-3.0`).                                             |

## Metadata Attributes (`metadata`)

Custom configuration properties and extension specifications (like declarative execution pipelines) that fall outside the standard Agent Skills frontmatter attributes should be placed inside `metadata`:

```yaml
metadata:
  allowed-tools: javascript show_toast generate_random_number
  author: ShadowClaw Team
  version: 1.0.0
  execution:
    type: tools
    suppressToast: true
    tools:
      - name: javascript
        input:
          code: Math.floor(Math.random() * 100) + 1
```
