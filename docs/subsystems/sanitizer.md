# Chat Template Sanitizer

> Sanitizes local-model output by stripping control tokens and structural wrappers before rendering.

**Source:** `src/chat-template-sanitizer.ts` · `src/chat-template-sanitizer.test.ts`

## Why this exists

Some local model runtimes may emit template/control artifacts in assistant output, such as:

- role wrappers
- chat-template delimiters
- non-user-facing control markers

These artifacts make responses noisy and can confuse downstream parsing/UI rendering.

## What it does

The sanitizer processes generated text and removes known template/control patterns while preserving intended user-visible content.

It is designed to be:

- **Safe**: avoids destructive rewriting of normal prose
- **Focused**: targets known structural/token artifacts
- **Tested**: behavior is validated with unit tests

## Where it is used

It is part of the local-model response handling path and complements provider/model capability logic documented in [Providers & Adapters](providers.md).

## Updating sanitizer behavior

1. Add or update a failing case in `src/chat-template-sanitizer.test.ts`.
2. Update implementation in `src/chat-template-sanitizer.ts`.
3. Re-run tests to confirm only intended artifacts are removed.

## Related docs

- [Providers & Adapters](providers.md)
- [Attachment Capabilities](attachment-capabilities.md)
