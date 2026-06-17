# Email Integration

> IMAP/SMTP support with encrypted credentials.

**Source:** `src/email/catalog.ts` · `src/email/connections.ts` · `src/tools/email.ts`

## Overview

The Email subsystem bridges the agent's workflow with external email communications. By providing native IMAP and SMTP support, it allows agents to autonomously read inboxes, process incoming requests, download email attachments directly into the workspace, and send outgoing responses or reports without relying on external API proxies or manual user intervention.

## Core Capabilities

The subsystem provides complete mail client functionality exposed as a set of tools to the agent:

- **IMAP Reading & Management**: Fetch messages (with filters like unread-only or limits), retrieve attachment metadata, download attachments, mark messages as read/unread, and delete messages.
- **SMTP Sending**: Compose and send plain text or HTML emails. It supports full routing fields (To, CC, BCC, Reply-To) and attaching workspace files.
- **Attachment Handling**: Attachments can be downloaded directly into the workspace (e.g., `downloads/email`) and workspace files can be seamlessly attached to outbound messages.
- **Agent Tools**: Dedicated tools (`manage_email`, `email_read_messages`, `email_send_message`) provide fine-grained control over email actions.

## Architecture and Persistence

Email configurations are managed as connection records and stored securely.

- **Connection Records**: Managed via `src/email/connections.ts`, connections are stored in IndexedDB under the `INTEGRATION_CONNECTIONS` config key. A connection consists of a plugin ID, a label, enablement status, and plugin-specific configuration (like host, port, and secure flags).
- **Plugins**: Supported protocols are defined in `src/email/catalog.ts` via `EmailPluginManifest` (e.g., the `imap` plugin which supports both `basic_userpass` and `oauth` auth types).
- **Credential Storage**: Passwords and OAuth secrets are never stored in plaintext. They are stored as `EmailCredentialRef` objects with the actual secret encrypted by the Cryptography subsystem (`encryptedSecret`).

## Tool Surface

The subsystem exposes three main tools to the agent (defined in `src/tools/email.ts`):

- `manage_email` — The omni-tool for managing connections (connect, configure, delete, test) and performing advanced email actions (download_attachments, mark_as_read/unread).
- `email_read_messages` — A focused tool to fetch recent messages. It supports parameters like `mailbox_path`, `limit`, and `unread_only`.
- `email_send_message` — A focused tool to compose and send emails, supporting rich formatting and file attachments from the workspace.

For more details on how these tools fit into the broader agent ecosystem, see `docs/subsystems/tools.md`.
