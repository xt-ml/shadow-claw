# Protocol-Agnostic Integrations

This guide defines a plugin architecture for external integrations (IMAP, RSS, Mastodon, etc.) that avoids one-off protocol-specific wiring.

## Goals

- Add new integrations by registering a plugin, not by editing core execution logic.
- Keep protocol details hidden behind typed plugin actions.
- Reuse the same auth and credential lifecycle patterns already used by Git/OAuth/MCP.

## Core Contract

Integration plugins implement a common contract:

- Metadata: `id`, `name`, `protocol`, `version`
- `actions`: declared operations with JSON-schema-like input/output
- `executeAction(actionName, input, context)`: runtime action dispatch

The shared contract lives in `src/integrations/types.ts`.

## Registry

The `IntegrationRegistry` in `src/integrations/registry.ts` provides:

- `register(plugin)` and `unregister(pluginId)`
- `list()` for discoverability and UI/docs tooling
- `execute(pluginId, actionName, input, context)` for safe dispatch

It enforces:

- No duplicate plugin IDs
- Action existence checks before execution

## Configurable Plugin Catalog

The configurable protocol catalog is defined in `src/integrations/catalog.ts`.

- Includes built-in manifests for IMAP, SMTP, RSS, XMPP, AT Protocol, ActivityPub, and Mastodon.
- Each manifest declares expected actions, auth modes, and configurable fields.
- New protocols can be onboarded by adding a manifest plus a plugin implementation.

Helper APIs:

- `listIntegrationPluginManifests()`
- `getIntegrationPluginManifest(id)`

## Connection Records

Per-account/per-endpoint plugin configuration is persisted through
`src/integrations/connections.ts` under config key `integration_connections`.

- Supports create/update/list/get by id or label.
- Stores plugin-specific config map and optional credential reference.
- Filters invalid or unknown plugin records during normalization.

This enables "many connections per protocol" (for example two IMAP inboxes,
three RSS feeds, and one Mastodon account) without adding bespoke schema files.

## Plugin Manager

`src/integrations/manager.ts` adds lazy-loading plugin factories:

- Register a factory per plugin id.
- Load plugin on first use.
- Execute action through registry after auto-load.

This keeps startup light while supporting many optional protocols.

## Recommended Action Taxonomy

To remain protocol-agnostic, prefer capability names over transport names:

- `messages.read`
- `messages.send`
- `feeds.pull`
- `social.publish`
- `calendar.list_events`

For user-facing tools, map these capabilities into stable tool names or a generic integration dispatcher tool.

## IMAP Mapping (Step 1 and Step 2)

IMAP plugin actions should be declared as capabilities:

- `messages.read`
  - Input: mailbox path, optional search criteria, max results
  - Output: normalized message summary list
- `messages.send`
  - Input: from/to/cc/bcc/subject/body, optional attachments
  - Output: sent status and provider message ID when available

This allows future SMTP/Graph/Gmail APIs to expose the same capability shape, even if the transport differs.

## Next Implementation Step

1. Add an IMAP plugin package under `src/integrations/plugins/imap/`.
2. Add server-side routes for IMAP network operations (Node runtime only).
3. Expose plugin actions as tools:
   - `integration_read_messages`
   - `integration_send_message`
4. Reuse encrypted credential storage for account secrets.
5. Add contract tests that every message-capable plugin passes.

After IMAP, repeat the same pattern for XMPP, AT Protocol, and ActivityPub by
adding plugin modules that satisfy the same action contract.
